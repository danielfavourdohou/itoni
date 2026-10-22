import { Play, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { formatDate } from "../lib/format";
import type { TemplateInfo, ValueRule } from "../lib/types";
import { KangaFrame } from "./Kanga";

const WARNING_KEYS = new Set(["warning_signs"]);

/** English sentence with values filled in; empty values show as a soft slot so staff see what is missing. */
function Sentence({ text, values, rules }: { text: string; values: Record<string, string>; rules: Record<string, ValueRule> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        if (!name) return part;
        const raw = name === "date" ? formatDate(values.follow_up_date || null) : values[name]?.trim();
        return raw ? (
          <span key={i} className="font-semibold">
            {raw}
          </span>
        ) : (
          <span key={i} className="rounded bg-saffron-soft px-1 text-[0.8em] text-muted">
            {rules[name]?.label.toLowerCase() ?? name}
          </span>
        );
      })}
    </>
  );
}

function FakePlay({ warning = false }: { warning?: boolean }) {
  return (
    <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${warning ? "bg-danger text-white" : "bg-saffron text-on-saffron"}`}>
      <Play aria-hidden className="size-3 fill-current" />
      Listen
    </span>
  );
}

/**
 * What the patient will see, updating as staff fill the form. It shows English: the Swahili is
 * created when the instruction is saved (translation and audio cost API calls, so not per keystroke).
 */
export function PhonePreview({
  patientLabel,
  selected,
  values,
  rules,
  footer,
}: {
  patientLabel: string;
  selected: TemplateInfo[];
  values: Record<string, string>;
  rules: Record<string, ValueRule>;
  footer?: ReactNode;
}) {
  const regular = selected.filter((t) => !WARNING_KEYS.has(t.key));
  const warnings = selected.filter((t) => WARNING_KEYS.has(t.key));
  const [first, ...rest] = regular;
  const counts = [
    ["Dose", values.dose],
    ["Times a day", values.times_per_day],
    ["Days", values.days],
  ].filter(([, v]) => v?.trim());

  return (
    <figure className="mx-auto w-full max-w-[320px]">
      <div className="rounded-[2.6rem] border-[10px] border-ink/90 bg-canvas shadow-float dark:border-black">
        <div className="relative h-[560px] overflow-y-auto rounded-[1.9rem] bg-canvas px-3 pt-8 pb-6 text-[13px] leading-snug text-ink [scrollbar-width:none]">
          <span aria-hidden className="absolute top-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-ink/90 dark:bg-black" />
          {selected.length === 0 ? (
            <p className="px-4 pt-40 text-center text-muted">Choose instructions to see the patient's screen.</p>
          ) : (
            <div className="space-y-3">
              <KangaFrame className="!p-1.5" innerClassName="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xs font-semibold">Ìtọ́ni</span>
                  {patientLabel.trim() && <span className="truncate rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">{patientLabel}</span>}
                </div>
                {first && (
                  <div>
                    <p className="font-display text-base leading-snug">
                      <Sentence text={first.english_text} values={values} rules={rules} />
                    </p>
                    <FakePlay />
                  </div>
                )}
              </KangaFrame>
              {rest.map((t) => (
                <div key={t.key} className="border-b border-line px-1 pb-3">
                  <p className="font-display text-[14px]">
                    <Sentence text={t.english_text} values={values} rules={rules} />
                  </p>
                  <FakePlay />
                </div>
              ))}
              {(values.drug?.trim() || counts.length > 0 || values.follow_up_date) && (
                <div className="overflow-hidden rounded-xl border border-primary/25 bg-surface">
                  {values.drug?.trim() && (
                    <div className="flex justify-between bg-primary px-3 py-2 text-on-primary">
                      <span className="text-[10px] opacity-80">Medicine</span>
                      <span className="font-display font-semibold">{values.drug}</span>
                    </div>
                  )}
                  {counts.length > 0 && (
                    <div className="grid grid-cols-3 divide-x divide-line">
                      {counts.map(([label, v]) => (
                        <div key={label} className="p-2">
                          <div className="text-[9px] text-muted">{label}</div>
                          <div className="font-display text-base font-semibold">{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {values.follow_up_date && (
                    <div className="flex justify-between border-t border-line bg-saffron-soft px-3 py-2">
                      <span className="text-[10px] text-muted">Come back on</span>
                      <span className="font-display font-semibold">{formatDate(values.follow_up_date)}</span>
                    </div>
                  )}
                </div>
              )}
              {warnings.map((t) => (
                <div key={t.key} className="rounded-xl border border-danger/40 bg-danger-soft p-3 text-danger-ink">
                  <p className="flex gap-1.5 font-display font-semibold">
                    <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span>{t.english_text}</span>
                  </p>
                  <FakePlay warning />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {footer && <figcaption className="mt-4 text-center text-xs text-muted">{footer}</figcaption>}
    </figure>
  );
}
