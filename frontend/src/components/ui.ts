// Shared class strings so buttons, inputs and surfaces look the same on every screen.
// Colours are theme tokens (index.css), so every string works in light and dark mode.

export const card = "rounded-2xl border border-line bg-surface";

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition " +
  "duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

/** The main action on a screen: indigo. */
export const btnPrimary = `${btnBase} bg-primary text-on-primary shadow-lift hover:bg-primary-strong`;
/** The brightest action, used sparingly (play, create): saffron. */
export const btnAccent = `${btnBase} bg-saffron text-on-saffron shadow-lift hover:brightness-105`;
export const btnSecondary = `${btnBase} border border-line bg-surface text-ink hover:border-primary/40 hover:bg-surface-2`;
export const btnGhost = `${btnBase} text-muted hover:bg-surface-2 hover:text-ink`;
export const btnDanger = `${btnBase} bg-danger text-white hover:brightness-110 dark:text-canvas`; // graphite on light red keeps 4.5:1 in dark

export const label = "block text-sm font-medium text-ink";
export const input =
  "mt-1.5 block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink transition " +
  "placeholder:text-muted/70 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";
export const fieldError = "mt-1.5 text-sm font-medium text-danger";

/** Small status chips. Text and icon, never colour alone. */
export const chip = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";
export const chipTone = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  saffron: "bg-saffron-soft text-ink dark:text-saffron",
  good: "bg-leaf-soft text-leaf-ink",
  danger: "bg-danger-soft text-danger-ink",
} as const;
