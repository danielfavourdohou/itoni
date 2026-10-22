import { LoaderCircle, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// One staff preview plays at a time across the whole screen.
let current: HTMLAudioElement | null = null;

/** Compact round play button for staff lists (inbox queue, previews). */
export function MiniPlayer({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false); // buffering on slow connections
  const [progress, setProgress] = useState(0);

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

  // Progress ring drawn as a conic gradient around the button.
  const ring = `conic-gradient(var(--saffron) ${Math.round(progress * 360)}deg, transparent 0)`;
  return (
    <span className="relative inline-grid size-11 shrink-0 place-items-center rounded-full" style={{ background: ring }}>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
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
        className="grid size-9 place-items-center rounded-full bg-primary text-on-primary transition hover:bg-primary-strong active:scale-90"
      >
        {loading ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : playing ? (
          <Pause aria-hidden className="size-4 fill-current" />
        ) : (
          <Play aria-hidden className="ml-0.5 size-4 fill-current" />
        )}
      </button>
    </span>
  );
}
