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

const QR_FINDERS: [number, number][] = [[76, 186], [130, 186], [76, 240]];
const QR_DOTS: [number, number][] = [[108, 190], [116, 204], [106, 218], [132, 222], [144, 236], [120, 246], [136, 256], [110, 232]];
const PILL_BARS: [number, number][] = [[172, 14], [168, 22], [174, 10], [166, 26], [171, 16]];
const REPLY_BARS = [6, 10, 4, 12, 8, 5, 11, 7, 4];
const CAUGHT_UP_BARS = [6, 12, 8, 14, 7, 10];

/** Landing hero: a phone showing a kanga-framed instruction speaking out loud, a QR slip, a voice reply. */
export function HeroIllustration({ className = "" }: { className?: string }) {
  const [KANGA_STRIP, Defs] = useKanga();
  return (
    <svg viewBox="0 0 480 420" aria-hidden className={className}>
      <Defs />
      {/* soft ground */}
      <ellipse cx="250" cy="392" rx="200" ry="16" className="fill-primary/10" />
      {/* QR handover slip, tilted, behind the phone */}
      <g transform="rotate(-9 110 250)">
        <rect x="40" y="150" width="150" height="190" rx="18" style={{ fill: KANGA_STRIP }} />
        <rect x="49" y="159" width="132" height="172" rx="12" className="fill-surface" />
        <rect x="70" y="180" width="90" height="90" rx="8" className="fill-white" />
        {QR_FINDERS.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="24" height="24" rx="3" className="fill-[#1B1F3B]" />
            <rect x={x + 6} y={y + 6} width="12" height="12" rx="2" className="fill-white" />
          </g>
        ))}
        {QR_DOTS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" rx="1.5" className="fill-[#1B1F3B]" />
        ))}
        <rect x="70" y="286" width="90" height="8" rx="4" className="fill-surface-2" />
        <rect x="82" y="302" width="66" height="8" rx="4" className="fill-surface-2" />
      </g>

      {/* phone */}
      <rect x="196" y="40" width="190" height="350" rx="34" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      <rect x="206" y="50" width="170" height="330" rx="26" className="fill-canvas" />
      <rect x="266" y="60" width="50" height="10" rx="5" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      {/* kanga-framed instruction card */}
      <rect x="218" y="84" width="146" height="132" rx="16" style={{ fill: KANGA_STRIP }} />
      <rect x="225" y="91" width="132" height="118" rx="11" className="fill-surface" />
      <rect x="237" y="105" width="86" height="9" rx="4.5" className="fill-ink/80" />
      <rect x="237" y="122" width="104" height="9" rx="4.5" className="fill-ink/80" />
      <rect x="237" y="139" width="70" height="9" rx="4.5" className="fill-ink/80" />
      {/* saffron play pill */}
      <rect x="237" y="164" width="90" height="30" rx="15" className="fill-saffron" />
      <circle cx="252" cy="179" r="10" className="fill-white/50" />
      <path d="M249 173.5v11l8.5-5.5z" className="fill-ink" />
      {PILL_BARS.map(([y, h], i) => (
        <rect key={i} x={268 + i * 7} y={y} width="3.5" height={h} rx="1.75" className="fill-ink/70" />
      ))}
      {/* digits label */}
      <rect x="218" y="232" width="146" height="70" rx="12" className="fill-surface" />
      <rect x="218" y="232" width="146" height="22" rx="12" className="fill-primary" />
      <rect x="218" y="246" width="146" height="8" className="fill-primary" />
      <text x="234" y="290" className="fill-ink font-display" fontSize="22" fontWeight="600">2 × 5</text>
      <rect x="300" y="276" width="48" height="16" rx="8" className="fill-saffron-soft" />
      {/* reply mic */}
      <circle cx="291" cy="340" r="22" className="fill-primary" />
      <rect x="286" y="328" width="10" height="17" rx="5" className="fill-on-primary" />
      <path d="M281 340a10 10 0 0 0 20 0" fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-on-primary" />

      {/* sound waves leaving the phone */}
      <g fill="none" strokeLinecap="round" strokeWidth="5" className="stroke-saffron">
        <path d="M404 150c14 14 14 44 0 58" />
        <path d="M424 132c26 26 26 76 0 102" opacity="0.55" />
      </g>
      {/* the patient's voice reply, translated */}
      <g>
        <rect x="330" y="0" width="140" height="50" rx="16" className="fill-surface" />
        <path d="M352 50l-6 14 18-14z" className="fill-surface" />
        <circle cx="352" cy="25" r="11" className="fill-hibiscus" />
        <path d="M349 20v10l8-5z" className="fill-white" />
        {REPLY_BARS.map((h, i) => (
          <rect key={i} x={372 + i * 9} y={25 - h / 2} width="4" height={h} rx="2" className="fill-hibiscus/70" />
        ))}
      </g>
    </svg>
  );
}

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
