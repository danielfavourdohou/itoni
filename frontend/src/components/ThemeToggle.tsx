import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme, type ThemePreference } from "../lib/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Segmented Light / Dark / System control (sidebar, login). */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl bg-surface-2 p-1">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            onClick={() => setPreference(value)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
              active ? "bg-surface text-ink shadow-lift" : "text-muted hover:text-ink"
            }`}
          >
            <Icon aria-hidden className="size-4" />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}

/** One button that cycles the three modes (phone top bar, where space is tight). */
export function ThemeCycleButton() {
  const { preference, setPreference } = useTheme();
  const index = OPTIONS.findIndex((o) => o.value === preference);
  const current = OPTIONS[index] ?? OPTIONS[2]!;
  const next = OPTIONS[(index + 1) % OPTIONS.length]!;
  return (
    <button
      type="button"
      onClick={() => setPreference(next.value)}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
      className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
    >
      <current.Icon aria-hidden className="size-5" />
    </button>
  );
}
