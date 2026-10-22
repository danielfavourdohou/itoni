import { LoaderCircle, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

const BARS = 34;

// One voice note plays at a time across the inbox.
let current: HTMLAudioElement | null = null;

/** A stable, natural-looking waveform per recording (seeded by its id; no audio decoding needed). */
function waveform(seed: number): number[] {
  let x = seed * 9301 + 49297;
  return Array.from({ length: BARS }, (_, i) => {
    x = (x * 9301 + 49297) % 233280;
    const noise = x / 233280;
    const envelope = Math.sin((Math.PI * (i + 1)) / (BARS + 1)); // louder in the middle, like speech
    return 0.18 + 0.82 * (0.35 * envelope + 0.65 * noise * envelope);
  });
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** WhatsApp-style voice note: play button, waveform that fills as it plays, duration. */
export function VoiceNote({ id, src, label }: { id: number; src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false); // buffering on slow connections
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoverAt, setHoverAt] = useState<number | null>(null); // 0..1 under the cursor
  const bars = useMemo(() => waveform(id), [id]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      if (current === audio) current = null;
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) return audio.pause();
    if (current && current !== audio) current.pause();
    current = audio;
    if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setLoading(true);
    void audio.play().catch(() => {
      setLoading(false);
      setPlaying(false);
    });
  }

  /** Click or tap on the waveform to jump to that point. */
  function seek(e: MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    setProgress(audio.currentTime / audio.duration);
  }

  const played = Math.round(progress * BARS);
  return (
    <div className="flex items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPlaying={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPause={() => {
          setPlaying(false);
          setLoading(false);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={`${playing ? "Pause" : "Play"} ${label}`}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary shadow-lift transition hover:bg-primary-strong active:scale-90"
      >
        {loading ? (
          <LoaderCircle aria-hidden className="size-5 animate-spin" />
        ) : playing ? (
          <Pause aria-hidden className="size-5 fill-current" />
        ) : (
          <Play aria-hidden className="ml-0.5 size-5 fill-current" />
        )}
      </button>
      <div
        aria-hidden
        onClick={seek}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHoverAt(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
        }}
        onMouseLeave={() => setHoverAt(null)}
        className="relative flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
      >
        {bars.map((h, i) => {
          const hovered = hoverAt !== null && i < Math.round(hoverAt * BARS) && i >= played;
          return (
            <span
              key={i}
              className={`w-full max-w-[4px] rounded-full transition-colors duration-150 ${
                i < played ? "bg-primary" : hovered ? "bg-primary/45" : "bg-muted/35"
              }`}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          );
        })}
        {/* Hover playhead: shows where a click will jump to, with the time. */}
        {hoverAt !== null && (
          <span className="pointer-events-none absolute inset-y-0" style={{ left: `${hoverAt * 100}%` }}>
            <span className="absolute inset-y-0 -left-px w-0.5 rounded-full bg-primary" />
            {duration > 0 && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-medium text-canvas tabular-nums">
                {clock(duration * hoverAt)}
              </span>
            )}
          </span>
        )}
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-muted tabular-nums">
        {clock(playing || progress > 0 ? duration * progress : duration)}
      </span>
    </div>
  );
}
