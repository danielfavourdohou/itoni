import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/StateViews";
import { btnPrimary, btnSecondary, card, fieldError, input, label } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { todayIso } from "../../lib/format";
import type {
  CreateInstructionPayload,
  InstructionDetail,
  TemplateInfo,
  TemplatesResponse,
  ValueRule,
} from "../../lib/types";
import { useApi } from "../../lib/useApi";

const DATE_PLACEHOLDER = "date"; // filled from the top-level follow_up_date, never sent per item

type Fields = Record<string, string[]>;

function FieldErrorText({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className={fieldError}>
      {errors[0]}
    </p>
  );
}

function ValueInput({
  id,
  rule,
  value,
  errors,
  onChange,
}: {
  id: string;
  rule: ValueRule;
  value: string;
  errors?: string[];
  onChange: (v: string) => void;
}) {
  const errorId = `${id}-error`;
  const common = {
    id,
    value,
    className: input,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-invalid": Boolean(errors?.length),
    "aria-describedby": errors?.length ? errorId : undefined,
  };
  return (
    <div>
      <label htmlFor={id} className={label}>
        {rule.label}
      </label>
      {rule.type === "integer" && (
        <input {...common} type="number" inputMode="numeric" min={rule.min} max={rule.max} step={1} />
      )}
      {rule.type === "text" && <input {...common} type="text" maxLength={rule.max_length} />}
      {rule.type === "date" && <input {...common} type="date" min={todayIso()} />}
      {rule.type === "integer" && (
        <p className="mt-1 text-xs text-slate-500">
          {rule.min} to {rule.max}
        </p>
      )}
      <FieldErrorText id={errorId} errors={errors} />
    </div>
  );
}

function buildPayload(
  patientLabel: string,
  followUpDate: string,
  selected: TemplateInfo[],
  values: Record<string, string>,
  rules: Record<string, ValueRule>,
): CreateInstructionPayload {
  const usesDate = selected.some((t) => t.placeholders.includes(DATE_PLACEHOLDER));
  return {
    patient_label: patientLabel,
    ...(usesDate && followUpDate ? { follow_up_date: followUpDate } : {}),
    items: selected.map((t) => ({
      template_key: t.key,
      values: Object.fromEntries(
        t.placeholders
          .filter((p) => p !== DATE_PLACEHOLDER)
          .map((p) => {
            const raw = (values[p] ?? "").trim();
            // Send whole numbers as numbers; anything else as typed, so the API reports it.
            return [p, rules[p]?.type === "integer" && /^\d+$/.test(raw) ? Number(raw) : raw];
          }),
      ),
    })),
  };
}

function Form({ data }: { data: TemplatesResponse }) {
  const navigate = useNavigate();
  const [patientLabel, setPatientLabel] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [followUpDate, setFollowUpDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({});

  const selected = data.templates.filter((t) => selectedKeys.has(t.key)); // keeps API (position) order

  function toggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFields({});
    try {
      const created = await api.post<InstructionDetail>(
        "/api/instructions/",
        buildPayload(patientLabel, followUpDate, selected, values, data.value_rules),
      );
      navigate(`/instructions/${created.id}`);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(apiErr?.message ?? "Something went wrong. Please try again.");
      setFields(apiErr?.fields ?? {});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  const withValues = selected.filter((t) => t.placeholders.length > 0);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <section className={`${card} space-y-4 p-5`}>
        <h2 className="font-semibold text-slate-900">Patient</h2>
        <div className="max-w-sm">
          <label htmlFor="patient_label" className={label}>
            Patient label
          </label>
          <input
            id="patient_label"
            className={input}
            maxLength={60}
            autoComplete="off"
            value={patientLabel}
            onChange={(e) => setPatientLabel(e.target.value)}
            aria-invalid={Boolean(fields.patient_label)}
            aria-describedby="patient_label-hint"
          />
          <p id="patient_label-hint" className="mt-1 text-xs text-slate-500">
            Initials or a nickname, such as "Mama A." No full names.
          </p>
          <FieldErrorText id="patient_label-error" errors={fields.patient_label} />
        </div>
      </section>

      <section className={`${card} space-y-4 p-5`}>
        <fieldset>
          <legend className="font-semibold text-slate-900">Instructions</legend>
          <p className="mt-1 text-sm text-slate-500">They appear to the patient in this order.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.templates.map((t) => {
              const checked = selectedKeys.has(t.key);
              return (
                <label
                  key={t.key}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700 ${
                    checked ? "border-teal-700 bg-teal-50/60" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(t.key)} />
                  <span
                    aria-hidden
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${
                      checked ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white"
                    }`}
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                  <span>
                    <span className="block font-medium text-slate-900">{t.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-500">{t.english_text}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <FieldErrorText id="items-error" errors={fields.items} />
        </fieldset>
      </section>

      {withValues.map((t) => (
        <section key={t.key} className={`${card} space-y-4 p-5`} aria-labelledby={`values-${t.key}`}>
          <h2 id={`values-${t.key}`} className="font-semibold text-slate-900">
            {t.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.placeholders.map((p) => {
              const rule = data.value_rules[p];
              if (!rule) return null;
              if (p === DATE_PLACEHOLDER) {
                return (
                  <ValueInput
                    key={p}
                    id="follow_up_date"
                    rule={rule}
                    value={followUpDate}
                    errors={fields.follow_up_date}
                    onChange={setFollowUpDate}
                  />
                );
              }
              return (
                <ValueInput
                  key={p}
                  id={`${t.key}-${p}`}
                  rule={rule}
                  value={values[p] ?? ""}
                  errors={fields[`items.${t.key}.${p}`]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [p]: v }))}
                />
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={`${btnPrimary} px-5 py-2.5`} disabled={submitting}>
          {submitting && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {submitting ? "Creating" : "Create instruction"}
        </button>
        <Link to="/" className={btnSecondary}>
          Cancel
        </Link>
        <p aria-live="polite" className="text-sm text-slate-500">
          {submitting && "Translating and creating Swahili audio. This can take a few seconds."}
        </p>
      </div>
    </form>
  );
}

export function NewInstruction() {
  const { data, error, loading, reload } = useApi<TemplatesResponse>("/api/templates/");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New instruction</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose the instructions, fill in the values, and Ìtọ́ni creates the Swahili text, audio and a QR code.
        </p>
      </div>
      {loading && !data && <LoadingState label="Loading templates" />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && <Form data={data} />}
    </div>
  );
}
