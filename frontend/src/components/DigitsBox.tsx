import type { Labels, PatientDigits } from "../lib/types";

// Safety: numbers are always shown as digits here, whatever the translated sentence says.
const COUNTS: { key: keyof PatientDigits; label: string }[] = [
  { key: "dose", label: "label_dose" },
  { key: "times_per_day", label: "label_times_per_day" },
  { key: "days", label: "label_days" },
];

/**
 * Styled like a pharmacy dispensing label: the medicine name as the label's title, the
 * numbers as big digits underneath. One of the few real-world objects drawn as a card.
 */
export function DigitsBox({ digits, labels }: { digits: PatientDigits; labels: Labels }) {
  const counts = COUNTS.filter((r) => digits[r.key]);
  if (!digits.medicine && counts.length === 0 && !digits.return_date) return null;
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-primary/25 bg-surface shadow-lift">
      {digits.medicine && (
        <div className="flex items-baseline justify-between gap-4 bg-primary px-5 py-4 text-on-primary">
          <span className="text-sm opacity-80">{labels.label_medicine}</span>
          <span lang="en" className="font-display text-2xl font-semibold">
            {digits.medicine}
          </span>
        </div>
      )}
      {counts.length > 0 && (
        <dl className={`grid ${counts.length === 1 ? "grid-cols-1" : counts.length === 2 ? "grid-cols-2" : "grid-cols-3"} divide-x divide-line`}>
          {counts.map((r) => (
            <div key={r.key} className="flex flex-col gap-1 p-4 sm:p-5">
              <dt className="text-sm leading-tight text-muted">{labels[r.label]}</dt>
              <dd lang="en" className="mt-auto font-display text-2xl leading-tight font-semibold break-words text-ink tabular-nums sm:text-3xl">
                {digits[r.key]}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {/* The return date gets a full-width row: DD/MM/YYYY never fits a third of a phone. */}
      {digits.return_date && (
        <div className={`flex items-baseline justify-between gap-4 bg-saffron-soft px-5 py-4 ${counts.length ? "border-t border-line" : ""}`}>
          <span className="text-sm text-muted">{labels.label_return_date}</span>
          <span lang="en" className="font-display text-2xl font-semibold text-ink tabular-nums">
            {digits.return_date}
          </span>
        </div>
      )}
    </section>
  );
}
