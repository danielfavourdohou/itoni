// Original flat illustrations, drawn with theme tokens so they follow light and dark mode.
// Decorative: every one is aria-hidden; the text next to it carries the meaning.
import { useId, type JSX } from "react";

/** Kanga pattern fill; each SVG gets its own id so several can share a page. */
function useKanga(): [string, () => JSX.Element] {
  const id = `kanga-${useId().replace(/:/g, "")}`;
  return [`url(#${id})`, () => <KangaDefs id={id} />];
}

function KangaDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" className="fill-[#2B3A9F]" />
        <path d="M6 1 11 6 6 11 1 6Z" className="fill-saffron" />
        <path d="M6 4 8 6 6 8 4 6Z" className="fill-hibiscus" />
      </pattern>
    </defs>
  );
}

const CAUGHT_UP_BARS = [6, 12, 8, 14, 7, 10];

/** Step 1: a checklist being filled in at the counter. */
export function StepCreate({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={className}>
      <rect x="30" y="10" width="100" height="104" rx="14" className="fill-surface" />
      <rect x="62" y="4" width="36" height="14" rx="7" className="fill-primary" />
      {[34, 60, 86].map((y, i) => (
        <g key={y}>
          <rect x="44" y={y} width="16" height="16" rx="5" className={i < 2 ? "fill-primary" : "fill-surface-2"} />
          {i < 2 && <path d={`M48 ${y + 8}l3 3 6-7`} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-on-primary" />}
          <rect x="68" y={y + 4} width={i === 1 ? 34 : 48} height="8" rx="4" className="fill-ink/25" />
        </g>
      ))}
      <circle cx="128" cy="96" r="18" className="fill-saffron" />
      <path d="M121 96h14M128 89v14" strokeWidth="3.5" strokeLinecap="round" className="stroke-on-saffron" />
    </svg>
  );
}

/** Step 2: the QR slip handed across the counter. */
export function StepHandover({ className = "" }: { className?: string }) {
  const [KANGA_STRIP, Defs] = useKanga();
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={className}>
      <Defs />
      <rect x="22" y="14" width="78" height="92" rx="12" style={{ fill: KANGA_STRIP }} />
      <rect x="28" y="20" width="66" height="80" rx="8" className="fill-surface" />
      <rect x="38" y="30" width="46" height="46" rx="5" className="fill-white" />
      <rect x="42" y="34" width="14" height="14" rx="2" className="fill-[#1B1F3B]" />
      <rect x="66" y="34" width="14" height="14" rx="2" className="fill-[#1B1F3B]" />
      <rect x="42" y="58" width="14" height="14" rx="2" className="fill-[#1B1F3B]" />
      <rect x="64" y="58" width="6" height="6" className="fill-[#1B1F3B]" />
      <rect x="72" y="64" width="6" height="6" className="fill-[#1B1F3B]" />
      <rect x="40" y="84" width="42" height="6" rx="3" className="fill-surface-2" />
      <rect x="100" y="40" width="42" height="72" rx="10" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      <rect x="104" y="46" width="34" height="60" rx="7" className="fill-canvas" />
      <path d="M112 66h18M121 57v18" strokeWidth="2" className="stroke-primary/40" />
      <rect x="110" y="56" width="22" height="22" rx="4" fill="none" strokeWidth="2.5" strokeDasharray="5 4" className="stroke-primary" />
    </svg>
  );
}

/** Step 3: the patient listens, then answers by voice. */
export function StepListen({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={className}>
      <rect x="44" y="8" width="64" height="108" rx="14" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      <rect x="49" y="14" width="54" height="96" rx="10" className="fill-canvas" />
      <rect x="56" y="26" width="40" height="22" rx="11" className="fill-saffron" />
      <path d="M64 31.5v11l8-5.5z" className="fill-ink" />
      <rect x="78" y="33" width="3" height="8" rx="1.5" className="fill-ink/60" />
      <rect x="84" y="30" width="3" height="14" rx="1.5" className="fill-ink/60" />
      <circle cx="76" cy="86" r="13" className="fill-primary" />
      <rect x="73" y="78" width="6" height="11" rx="3" className="fill-on-primary" />
      <g fill="none" strokeLinecap="round" strokeWidth="3.5" className="stroke-saffron">
        <path d="M118 44c8 8 8 24 0 32" />
        <path d="M130 34c14 14 14 38 0 52" opacity="0.5" />
      </g>
      <g fill="none" strokeLinecap="round" strokeWidth="3.5" className="stroke-hibiscus">
        <path d="M34 76c-6-6-6-18 0-24" />
        <path d="M24 84c-11-11-11-30 0-41" opacity="0.5" />
      </g>
    </svg>
  );
}

/** Small: an answered message, for "nothing waiting" empty states. */
export function AllCaughtUp({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" aria-hidden className={className}>
      <rect x="14" y="10" width="78" height="52" rx="16" className="fill-surface-2" />
      <path d="M30 62l-4 16 18-16z" className="fill-surface-2" />
      {CAUGHT_UP_BARS.map((h, i) => (
        <rect key={i} x={30 + i * 8} y={36 - h / 2} width="4" height={h} rx="2" className="fill-muted/50" />
      ))}
      <circle cx="90" cy="60" r="20" className="fill-leaf-soft" />
      <path d="M81 60l6 6 12-13" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="stroke-leaf" />
    </svg>
  );
}

/** 404: a phone showing an empty, dashed page under a magnifying glass. */
export function LostPage({ className = "" }: { className?: string }) {
  const [KANGA_STRIP, Defs] = useKanga();
  return (
    <svg viewBox="0 0 360 320" aria-hidden className={className}>
      <Defs />
      <ellipse cx="180" cy="300" rx="140" ry="12" className="fill-primary/10" />
      <rect x="104" y="20" width="152" height="276" rx="28" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      <rect x="113" y="29" width="134" height="258" rx="20" className="fill-canvas" />
      <rect x="156" y="38" width="48" height="9" rx="4.5" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      {/* the missing page: a dashed outline where content should be */}
      <rect x="126" y="64" width="108" height="120" rx="14" fill="none" strokeWidth="3" strokeDasharray="8 7" className="stroke-muted/50" />
      <text x="180" y="142" textAnchor="middle" className="fill-muted/60 font-display" fontSize="54" fontWeight="600">?</text>
      <rect x="126" y="200" width="108" height="12" rx="6" className="fill-surface-2" />
      <rect x="140" y="222" width="80" height="12" rx="6" className="fill-surface-2" />
      {/* a kanga strip, unravelled, trailing off the screen */}
      <path d="M126 258c30-12 60 12 90 0s50-14 82 4" fill="none" strokeWidth="12" strokeLinecap="round" style={{ stroke: KANGA_STRIP }} />
      {/* magnifying glass */}
      <circle cx="262" cy="118" r="40" className="fill-surface/70" />
      <circle cx="262" cy="118" r="40" fill="none" strokeWidth="9" className="stroke-saffron" />
      <path d="M291 147l34 34" strokeWidth="13" strokeLinecap="round" className="stroke-saffron" />
      <path d="M244 104a22 22 0 0 1 22-10" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-white/80" />
    </svg>
  );
}
