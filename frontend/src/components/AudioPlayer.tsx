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

/** Big play button for the patient screen (native controls are tiny on phones). */
export function AudioPlayer({ src, playLabel, pauseLabel, tone = "default" }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
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

  const colours =
    tone === "warning"
      ? "bg-red-700 text-white hover:bg-red-800"
      : "bg-teal-700 text-white hover:bg-teal-800";

  return (
    <div className="space-y-3">
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
        className={`inline-flex min-h-14 shrink-0 items-center gap-3 rounded-full py-3 pr-6 pl-4 text-lg font-semibold transition active:scale-95 disabled:opacity-50 ${colours}`}
      >
        {failed ? (
          <VolumeX aria-hidden className="size-7" />
        ) : playing ? (
          <Pause aria-hidden className="size-7 fill-current" />
        ) : (
          <Play aria-hidden className="size-7 fill-current" />
        )}
        {playing ? pauseLabel : playLabel}
      </button>
      {/* Full width under the button (long translated labels would squeeze it), only once started. */}
      {(playing || progress > 0) && (
        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${tone === "warning" ? "bg-red-700" : "bg-teal-700"}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
