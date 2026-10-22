import { LoaderCircle, Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { api, ApiError } from "../lib/api";
import type { Labels, ReplyErrorCode, ReplySubmitResponse } from "../lib/types";

// Matches ITONI_REPLY_MAX_SECONDS (default 60); the server trims anything longer anyway.
const MAX_SECONDS = 60;
const METER_BARS = 9;

// "starting" covers the browser's microphone permission prompt, which can take a while.
type State = "idle" | "starting" | "recording" | "sending" | "sent" | "error";

/** First container this browser can record: Chrome/Firefox WebM, Safari MP4. The server converts. */
function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function formatSeconds(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Animated check that draws itself once: the "sent" confirmation. */
function DrawnCheck() {
  return (
    <svg viewBox="0 0 56 56" aria-hidden className="size-16">
      <circle cx="28" cy="28" r="26" className="fill-leaf-soft" />
      <path
        d="M17 29l7 7 15-16"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="24 100"
        className="stroke-leaf motion-safe:animate-[draw-check_450ms_ease-out_120ms_both]"
      />
    </svg>
  );
}

export function Recorder({ token, labels }: { token: string; labels: Labels }) {
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [errorText, setErrorText] = useState("");
  const [micBlocked, setMicBlocked] = useState(false);
  const [meterLive, setMeterLive] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const canRecord =
    typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  function stopMeter() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setMeterLive(false);
  }

  /** Bars follow the real voice level, so the patient can see the phone is hearing them. */
  function startMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < METER_BARS; i++) {
          // Mirror around the centre bar; low bins carry most of a voice's energy.
          const bin = Math.abs(i - Math.floor(METER_BARS / 2)) + 1;
          const level = (data[bin] ?? 0) / 255;
          const bar = barRefs.current[i];
          if (bar) bar.style.transform = `scaleY(${Math.max(0.12, level).toFixed(3)})`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMeterLive(true);
    } catch {
      setMeterLive(false); // no Web Audio: the pulse ring stands in
    }
  }

  function releaseMic() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    stopMeter();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Leaving the page mid-recording must not send anything. Reset on mount: StrictMode
  // mounts, unmounts and remounts, and a stale `true` would silently drop every recording.
  useEffect(() => {
    discardRef.current = false;
    return () => {
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMic();
    };
  }, []);

  async function send(audio: Blob, filename: string) {
    setState("sending");
    setErrorText("");
    const form = new FormData();
    form.append("consent", "true"); // the button is only enabled once the box is ticked
    form.append("audio_file", audio, filename);
    try {
      await api.post<ReplySubmitResponse>(`/api/p/${encodeURIComponent(token)}/reply/`, form);
      setState("sent");
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: ReplyErrorCode } | null)?.code : undefined;
      setErrorText((code === "rate_limited" ? labels.label_reply_too_many : labels.label_reply_error) ?? "");
      setState("error");
    }
  }

  async function startRecording() {
    setErrorText("");
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicBlocked(true);
      setState("idle");
      return;
    }
    if (discardRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    const mime = pickMimeType();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      releaseMic();
      if (discardRef.current) return;
      const type = recorder.mimeType || mime || "audio/webm";
      void send(new Blob(chunks, { type }), `reply.${extensionFor(type)}`);
    };
    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
    setSecondsLeft(MAX_SECONDS);
    startMeter(stream);

    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const left = Math.max(0, MAX_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setSecondsLeft(left);
      if (left === 0) stopRecording(); // auto-stop at the cap, then send
    }, 250);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function handleMainButton() {
    if (state === "recording") stopRecording();
    else void startRecording();
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again should still trigger a send
    if (file) void send(file, file.name);
  }

  const recording = state === "recording";
  const busy = state === "starting" || recording || state === "sending";
  const recordDisabled = !consent || !canRecord || micBlocked || state === "starting" || state === "sending";
  const liveText = recording ? labels.label_reply_hint : state === "sent" ? labels.label_reply_received : state === "error" ? errorText : "";

  return (
    <section aria-labelledby="reply-heading" className="space-y-5 border-t border-line pt-8">
      <h2 id="reply-heading" className="font-display text-2xl font-semibold text-ink">
        {labels.label_reply_button}
      </h2>

      {state === "sent" ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-leaf-soft/60 px-6 py-8 text-center">
          <DrawnCheck />
          <p className="font-display text-xl text-ink">{labels.label_reply_received}</p>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-5 text-base font-medium text-ink active:scale-95"
          >
            <Mic aria-hidden className="size-5" />
            {labels.label_reply_button}
          </button>
        </div>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-3.5 rounded-2xl bg-surface-2/70 p-4 text-base leading-relaxed text-ink">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 size-6 shrink-0 accent-[var(--primary)]"
            />
            <span>{labels.label_reply_consent}</span>
          </label>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative grid place-items-center">
              {recording && !meterLive && (
                <span aria-hidden className="absolute inset-0 rounded-full bg-danger/35 motion-safe:animate-ping" />
              )}
              <button
                type="button"
                onClick={handleMainButton}
                disabled={recordDisabled}
                aria-label={labels.label_reply_button}
                aria-describedby="reply-hint"
                className={`relative grid size-28 place-items-center rounded-full shadow-float transition duration-150 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:shadow-none ${
                  recording ? "bg-danger text-white" : "bg-primary text-on-primary hover:bg-primary-strong"
                }`}
              >
                {state === "sending" || state === "starting" ? (
                  <LoaderCircle aria-hidden className="size-11 animate-spin" />
                ) : recording ? (
                  <Square aria-hidden className="size-10 fill-current" />
                ) : (
                  <Mic aria-hidden className="size-12" />
                )}
              </button>
            </div>

            {recording && (
              <div className="flex flex-col items-center gap-3">
                {meterLive && (
                  <div aria-hidden className="flex h-10 items-center gap-1.5">
                    {Array.from({ length: METER_BARS }, (_, i) => (
                      <span
                        key={i}
                        ref={(el) => {
                          barRefs.current[i] = el;
                        }}
                        className="h-full w-1.5 origin-center scale-y-[0.12] rounded-full bg-danger transition-transform duration-75"
                      />
                    ))}
                  </div>
                )}
                <p lang="en" className="font-display text-4xl font-semibold text-danger tabular-nums">
                  {formatSeconds(secondsLeft)}
                </p>
              </div>
            )}
            <p id="reply-hint" className="max-w-xs text-center text-base text-muted">
              {labels.label_reply_hint}
            </p>
          </div>

          {(state === "error" || micBlocked) && (
            <p role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-base text-danger-ink">
              {state === "error" ? errorText : labels.label_reply_mic_blocked}
            </p>
          )}

          <label
            className={`flex min-h-14 items-center justify-center gap-2.5 rounded-full border-2 border-dashed px-5 py-3 text-center text-base font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-saffron ${
              !consent || busy ? "cursor-not-allowed border-line text-muted/70" : "cursor-pointer border-primary/50 text-primary hover:bg-primary-soft"
            }`}
          >
            <Upload aria-hidden className="size-5 shrink-0" />
            {labels.label_reply_upload}
            <input type="file" accept="audio/*" className="sr-only" disabled={!consent || busy} onChange={handleFile} />
          </label>
        </>
      )}

      <p aria-live="polite" className="sr-only">
        {liveText}
      </p>
    </section>
  );
}
