import type { Labels, PatientDigits } from "../lib/types";

// Safety: numbers are always shown as digits here, whatever the translated sentence says.
const ROWS: { key: keyof PatientDigits; label: string }[] = [
  { key: "medicine", label: "label_medicine" },
  { key: "dose", label: "label_dose" },
  { key: "times_per_day", label: "label_times_per_day" },
  { key: "days", label: "label_days" },
  { key: "return_date", label: "label_return_date" },
];

export function DigitsBox({ digits, labels }: { digits: PatientDigits; labels: Labels }) {
  const rows = ROWS.filter((r) => digits[r.key]);
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border-2 border-teal-700 bg-white p-5">
      <dl className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <dt className="text-base text-slate-600">{labels[r.label] ?? ""}</dt>
            <dd lang="en" className="text-right text-2xl font-bold tabular-nums text-slate-900">
              {digits[r.key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
