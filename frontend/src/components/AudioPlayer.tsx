import { Pause, Play, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Only one instruction speaks at a time: starting one pauses whichever was playing.
let current: HTMLAudioElement | null = null;

interface Props {
  src: string;
  playLabel: string;
  pauseLabel: string;
  tone?: "default" | "warning";
}

const BAR_DELAYS = ["0ms", "-280ms", "-120ms", "-420ms", "-200ms"];

/**
 * Patient play button: a saffron pill. While playing, five bars dance inside it and the pill
 * fills left to right, so "sound is playing" reads without any reading at all.
 */
export function AudioPlayer({ src, playLabel, pauseLabel, tone = "default" }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

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
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (current && current !== audio) current.pause();
    current = audio;
    audio.play().catch(() => setFailed(true));
  }

  const warning = tone === "warning";
  const base = warning ? "bg-danger text-white" : "bg-saffron text-on-saffron";
  const fill = warning ? "bg-black/20" : "bg-black/12 dark:bg-black/20";

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-pressed={playing}
        className={`relative isolate inline-flex min-h-16 items-center gap-3 overflow-hidden rounded-full py-3 pr-7 pl-3 text-lg font-semibold shadow-lift transition duration-150 active:scale-[0.97] disabled:opacity-50 ${base}`}
      >
        {/* Progress fills the pill from the left. */}
        <span aria-hidden className={`absolute inset-y-0 left-0 -z-10 transition-[width] duration-200 ease-linear ${fill}`} style={{ width: `${Math.round(progress * 100)}%` }} />
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${warning ? "bg-white/20" : "bg-white/40 dark:bg-white/30"}`}>
          {failed ? (
            <VolumeX aria-hidden className="size-6" />
          ) : playing ? (
            <Pause aria-hidden className="size-6 fill-current" />
          ) : (
            <Play aria-hidden className="ml-0.5 size-6 fill-current" />
          )}
        </span>
        {playing && (
          <span aria-hidden className="flex h-6 items-center gap-[3px]">
            {BAR_DELAYS.map((delay, i) => (
              <span
                key={i}
                className="h-full w-[3px] origin-center rounded-full bg-current motion-safe:animate-[wave_850ms_ease-in-out_infinite]"
                style={{ animationDelay: delay }}
              />
            ))}
          </span>
        )}
        <span>{playing ? pauseLabel : playLabel}</span>
      </button>
    </>
  );
}
