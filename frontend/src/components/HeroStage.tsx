import { useEffect, useId, useRef, type ReactNode } from "react";

import photo1400 from "../assets/hero-care-1400.webp";
import photo760 from "../assets/hero-care-760.webp";
import { KangaFrame } from "./Kanga";

/** Cursor effects only for a real mouse/trackpad and when motion is welcome. Never on touch. */
function wantsPointerEffects(): boolean {
  return window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches;
}

/**
 * Kanga cloth behind a whole page, lit where the cursor is. Fixed to the viewport, so the light
 * follows the pointer as the page scrolls. Opaque sections (the indigo band) simply cover it.
 */
export function KangaLight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !wantsPointerEffects()) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--px", `${x}px`);
      el.style.setProperty("--py", `${y}px`);
      el.dataset.lit = "true";
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      el.dataset.lit = "false";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} data-lit="false" aria-hidden className="hero-surface pointer-events-none fixed inset-0 -z-10">
      <div className="kanga-tile absolute inset-0 opacity-[0.04] dark:opacity-[0.035]" />
      <div className="kanga-light kanga-tile absolute inset-0" />
      <div className="kanga-glow absolute inset-0" />
    </div>
  );
}

/**
 * The landing hero surface. As the cursor moves it sets --mx/--my (-1..1) on the element for the
 * parallax depth of the stage. Updates are batched to one per frame.
 */
export function HeroSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !wantsPointerEffects()) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      if (!last) return;
      const r = el.getBoundingClientRect();
      const x = last.clientX - r.left;
      const y = last.clientY - r.top;
      el.style.setProperty("--mx", ((x / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty("--my", ((y / r.height) * 2 - 1).toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className={`group/hero relative ${className}`}>
      {/* The hero's cloth is a little stronger than the rest of the page, fading into it. */}
      <div aria-hidden className="kanga-tile absolute inset-0 opacity-[0.05] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] dark:opacity-[0.04]" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** One parallax layer: moves `depth` px at the edge of the hero, in the cursor's direction. */
function Layer({ depth, className = "", children }: { depth: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={`transition-transform duration-300 ease-out will-change-transform ${className}`}
      style={{ transform: `translate3d(calc(var(--mx, 0) * ${depth}px), calc(var(--my, 0) * ${depth}px), 0)` }}
    >
      {children}
    </div>
  );
}

/** Phone in front of the photo: the patient's screen, the thing Ìtọ́ni hands over. */
const PILL_BARS: [number, number][] = [[62, 12], [68, 20], [74, 9], [80, 24], [86, 14], [92, 18], [98, 10]];

function HeroPhone() {
  const kanga = `hero-kanga-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 170 300" aria-hidden className="w-full drop-shadow-xl">
      <defs>
        <pattern id={kanga} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" className="fill-[#2B3A9F]" />
          <path d="M5 .8 9.2 5 5 9.2.8 5Z" className="fill-saffron" />
          <path d="M5 3.2 6.8 5 5 6.8 3.2 5Z" className="fill-hibiscus" />
        </pattern>
      </defs>
      <rect width="170" height="300" rx="28" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      <rect x="8" y="8" width="154" height="284" rx="21" className="fill-canvas" />
      <rect x="60" y="16" width="50" height="9" rx="4.5" className="fill-[#1B1F3B] dark:fill-[#3A3D46]" />
      <rect x="18" y="38" width="134" height="118" rx="14" style={{ fill: `url(#${kanga})` }} />
      <rect x="24" y="44" width="122" height="106" rx="10" className="fill-surface" />
      <rect x="34" y="56" width="80" height="8" rx="4" className="fill-ink/75" />
      <rect x="34" y="71" width="96" height="8" rx="4" className="fill-ink/75" />
      <rect x="34" y="86" width="64" height="8" rx="4" className="fill-ink/75" />
      <rect x="34" y="108" width="84" height="28" rx="14" className="fill-saffron" />
      <circle cx="48" cy="122" r="9" className="fill-white/50" />
      <path d="M45.5 117v10l7.5-5z" className="fill-ink" />
      {PILL_BARS.map(([x, h]) => (
        <rect key={x} x={x} y={122 - h / 2} width="3" height={h} rx="1.5" className="fill-ink/70" />
      ))}
      <rect x="18" y="168" width="134" height="62" rx="12" className="fill-surface" />
      <rect x="18" y="168" width="134" height="20" rx="12" className="fill-primary" />
      <rect x="18" y="180" width="134" height="8" className="fill-primary" />
      <text x="32" y="216" className="fill-ink font-display" fontSize="20" fontWeight="600">2 × 5</text>
      <rect x="96" y="203" width="44" height="15" rx="7.5" className="fill-saffron-soft" />
      <circle cx="85" cy="262" r="18" className="fill-primary" />
      <rect x="80.5" y="252" width="9" height="15" rx="4.5" className="fill-on-primary" />
    </svg>
  );
}

/** Photo at the back, phone in front, a translated voice note on top: three depths. */
export function HeroStage() {
  return (
    <div className="relative mx-auto w-full max-w-xl pb-10 lg:max-w-none lg:pb-0">
      <Layer depth={6}>
        <KangaFrame innerClassName="overflow-hidden">
          <img
            src={photo1400}
            srcSet={`${photo760} 760w, ${photo1400} 1400w`}
            sizes="(min-width: 1024px) 560px, 92vw"
            width={1400}
            height={1050}
            alt="A nurse checks on a young child in a hospital ward while the child's father watches."
            className="block aspect-[4/3] w-full object-cover transition duration-700 group-hover/hero:scale-[1.02] dark:brightness-[0.85] dark:saturate-[0.9]"
            // React 18 only forwards the lowercase attribute; it tells the browser to load the hero image first.
            {...{ fetchpriority: "high" }}
          />
        </KangaFrame>
      </Layer>
      <Layer depth={-16} className="absolute -bottom-2 left-1 w-[30%] min-w-28 sm:-left-8 lg:-bottom-10">
        <HeroPhone />
      </Layer>
      <Layer depth={-24} className="absolute -top-5 right-3 sm:right-6">
        <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 shadow-float">
          <span className="grid size-8 place-items-center rounded-full bg-hibiscus text-white">
            <svg viewBox="0 0 10 10" aria-hidden className="ml-0.5 size-3 fill-current">
              <path d="M2 1v8l7-4z" />
            </svg>
          </span>
          <span aria-hidden className="flex h-6 items-center gap-[3px]">
            {[8, 14, 6, 18, 11, 7, 15, 9, 5].map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-hibiscus/70" style={{ height: h }} />
            ))}
          </span>
          <span className="text-xs font-medium text-muted">Reply, in English</span>
        </div>
      </Layer>
    </div>
  );
}
