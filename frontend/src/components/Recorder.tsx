import { CircleCheck, LoaderCircle, Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { api, ApiError } from "../lib/api";
import type { Labels, ReplyErrorCode, ReplySubmitResponse } from "../lib/types";

// Matches ITONI_REPLY_MAX_SECONDS (default 60); the server trims anything longer anyway.
const MAX_SECONDS = 60;

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

export function Recorder({ token, labels }: { token: string; labels: Labels }) {
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [errorText, setErrorText] = useState("");
  const [micBlocked, setMicBlocked] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false);

  const canRecord =
    typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  function releaseMic() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
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

  const busy = state === "starting" || state === "recording" || state === "sending";
  const recordDisabled = !consent || !canRecord || micBlocked || state === "starting" || state === "sending";
  const liveText =
    state === "recording"
      ? labels.label_reply_hint
      : state === "sent"
        ? labels.label_reply_received
        : state === "error"
          ? errorText
          : "";

  return (
    <section aria-labelledby="reply-heading" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="reply-heading" className="text-xl font-semibold text-slate-900">
        {labels.label_reply_button}
      </h2>

      {state === "sent" ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CircleCheck aria-hidden className="size-14 text-emerald-600" />
          <p className="text-lg text-slate-900">{labels.label_reply_received}</p>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-300 px-5 text-base font-medium text-slate-700 active:scale-95"
          >
            <Mic aria-hidden className="size-5" />
            {labels.label_reply_button}
          </button>
        </div>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 text-base text-slate-700">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-6 shrink-0 accent-teal-700"
            />
            <span>{labels.label_reply_consent}</span>
          </label>

          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {state === "recording" && (
                <span aria-hidden className="absolute inset-0 rounded-full bg-red-500/40 motion-safe:animate-ping" />
              )}
              <button
                type="button"
                onClick={handleMainButton}
                disabled={recordDisabled}
                aria-label={labels.label_reply_button}
                aria-describedby="reply-hint"
                className={`relative grid size-24 place-items-center rounded-full text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 ${
                  state === "recording" ? "bg-red-600 hover:bg-red-700" : "bg-teal-700 hover:bg-teal-800"
                }`}
              >
                {state === "sending" || state === "starting" ? (
                  <LoaderCircle aria-hidden className="size-10 animate-spin" />
                ) : state === "recording" ? (
                  <Square aria-hidden className="size-9 fill-current" />
                ) : (
                  <Mic aria-hidden className="size-10" />
                )}
              </button>
            </div>
            {state === "recording" && (
              <p lang="en" className="text-3xl font-bold tabular-nums text-red-700">
                {formatSeconds(secondsLeft)}
              </p>
            )}
            <p id="reply-hint" className="text-center text-base text-slate-600">
              {labels.label_reply_hint}
            </p>
          </div>

          {(state === "error" || micBlocked) && (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-base text-red-900">
              {state === "error" ? errorText : labels.label_reply_mic_blocked}
            </p>
          )}

          <label
            className={`flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed px-4 py-3 text-center text-base font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700 ${
              !consent || busy
                ? "cursor-not-allowed border-slate-200 text-slate-400"
                : "cursor-pointer border-teal-700 text-teal-800 hover:bg-teal-50"
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
