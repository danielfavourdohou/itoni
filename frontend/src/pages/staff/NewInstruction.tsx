import { Check, CircleAlert, Eye, LoaderCircle, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PhonePreview } from "../../components/PhonePreview";
import { ErrorState, LoadingState } from "../../components/StateViews";
import { btnGhost, btnPrimary, fieldError, input, label } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { todayIso } from "../../lib/format";
import type { CreateInstructionPayload, InstructionDetail, TemplateInfo, TemplatesResponse, ValueRule } from "../../lib/types";
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
        {rule.type === "integer" && (
          <span className="ml-1.5 font-normal text-muted">
            {rule.min} to {rule.max}
          </span>
        )}
      </label>
      {rule.type === "integer" && <input {...common} type="number" inputMode="numeric" min={rule.min} max={rule.max} step={1} />}
      {rule.type === "text" && <input {...common} type="text" maxLength={rule.max_length} />}
      {rule.type === "date" && <input {...common} type="date" min={todayIso()} />}
      <FieldErrorText id={errorId} errors={errors} />
    </div>
  );
}

/** "Take {dose} of {drug}" with each placeholder shown as a labelled slot, not raw braces. */
function TemplateText({ text, rules }: { text: string; rules: Record<string, ValueRule> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        if (!name) return part;
        return (
          <span key={i} className="rounded bg-surface-2 px-1 font-medium text-ink/80">
            {rules[name]?.label.toLowerCase() ?? name}
          </span>
        );
      })}
    </>
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
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [followUpDate, setFollowUpDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({});

  const selected = data.templates.filter((t) => selectedKeys.has(t.key)); // API (position) order
  const previewValues = { ...values, follow_up_date: followUpDate };

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
      navigate(`/instructions/${created.id}`, { viewTransition: true });
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(apiErr?.message ?? "Something went wrong. Please try again.");
      setFields(apiErr?.fields ?? {});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  const preview = (
    <PhonePreview
      patientLabel={patientLabel}
      selected={selected}
      values={previewValues}
      rules={data.value_rules}
      footer="Preview in English. The Swahili text and audio are created when you save."
    />
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-16">
      <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-10">
        {error && (
          <div role="alert" className="flex gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-sm text-danger-ink">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <section aria-labelledby="h-patient" className="space-y-4">
          <h2 id="h-patient" className="border-b border-line pb-3 font-display text-lg font-semibold">
            Who is it for?
          </h2>
          <div className="max-w-sm">
            <label htmlFor="patient_label" className={label}>
              Patient label
            </label>
            <input
              id="patient_label"
              className={input}
              maxLength={60}
              autoComplete="off"
              placeholder="Mama A."
              value={patientLabel}
              onChange={(e) => setPatientLabel(e.target.value)}
              aria-invalid={Boolean(fields.patient_label)}
              aria-describedby={fields.patient_label ? "patient_label-hint patient_label-error" : "patient_label-hint"}
            />
            <p id="patient_label-hint" className="mt-1.5 text-sm text-muted">
              Initials or a nickname. No full names.
            </p>
            <FieldErrorText id="patient_label-error" errors={fields.patient_label} />
          </div>
        </section>

        <section aria-labelledby="h-instr" className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
            <h2 id="h-instr" className="font-display text-lg font-semibold">
              What should they do?
            </h2>
            <span className="text-sm text-muted tabular-nums">{selected.length} chosen</span>
          </div>
          <p className="pt-2 text-sm text-muted">The patient sees them in this order.</p>
          <FieldErrorText id="items-error" errors={fields.items} />
          <ul className="divide-y divide-line">
            {data.templates.map((t) => {
              const checked = selectedKeys.has(t.key);
              const valueNames = t.placeholders;
              return (
                <li key={t.key}>
                  <label className="group flex cursor-pointer items-start gap-4 rounded-xl px-2 py-4 transition hover:bg-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-saffron">
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(t.key)} />
                    <span
                      aria-hidden
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition ${
                        checked ? "scale-105 border-primary bg-primary text-on-primary" : "border-line bg-surface group-hover:border-primary/50"
                      }`}
                    >
                      {checked && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{t.title}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                        <TemplateText text={t.english_text} rules={data.value_rules} />
                      </span>
                    </span>
                  </label>
                  {valueNames.length > 0 && (
                    // Value fields open right under the template that needs them.
                    <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${checked ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <div className="mb-4 ml-12 grid gap-4 rounded-xl bg-surface-2/60 p-4 sm:grid-cols-2">
                          {valueNames.map((p) => {
                            const rule = data.value_rules[p];
                            if (!rule || !checked) return null;
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
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <button type="submit" className={`${btnPrimary} min-h-12 px-6 text-base`} disabled={submitting}>
            {submitting && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
            {submitting ? "Creating" : "Create instruction"}
          </button>
          <button type="button" className={`${btnGhost} lg:hidden`} onClick={() => sheetRef.current?.showModal()}>
            <Eye aria-hidden className="size-4" />
            Preview
          </button>
          <Link to="/" viewTransition className={btnGhost}>
            Cancel
          </Link>
          <p aria-live="polite" className="w-full text-sm text-muted">
            {submitting && "Translating and creating Swahili audio. This can take a few seconds."}
          </p>
        </div>
      </form>

      <aside aria-label="Patient screen preview" className="hidden lg:block">
        <div className="sticky top-8">{preview}</div>
      </aside>

      {/* Phones and tablets: the preview opens as a bottom sheet. */}
      <dialog
        ref={sheetRef}
        aria-label="Patient screen preview"
        className="mx-auto mt-auto mb-0 w-full max-w-md rounded-t-3xl border border-line bg-canvas p-5 text-ink backdrop:bg-black/50 open:motion-safe:animate-[toast-in_220ms_ease-out]"
        onClick={(e) => {
          if (e.target === sheetRef.current) sheetRef.current.close(); // tap outside closes
        }}
      >
        <div className="mb-3 flex justify-end">
          <button type="button" aria-label="Close preview" onClick={() => sheetRef.current?.close()} className="grid size-10 place-items-center rounded-xl hover:bg-surface-2">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {preview}
      </dialog>
    </div>
  );
}

export function NewInstruction() {
  const { data, error, loading, reload } = useApi<TemplatesResponse>("/api/templates/");
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">New instruction</h1>
        <p className="mt-1 text-muted">Swahili text, audio and a QR code, in one step.</p>
      </header>
      {loading && !data && <LoadingState label="Loading templates" />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && <Form data={data} />}
    </div>
  );
}
