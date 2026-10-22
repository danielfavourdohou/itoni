import { Check, CircleAlert, CircleCheck, FlaskConical, Info, LoaderCircle, Pencil, RotateCcw, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { btnPrimary, btnSecondary, card, fieldError } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type { TranslationListResponse, TranslationRow } from "../../lib/types";
import { useApi } from "../../lib/useApi";

type Filter = "review" | "approved" | "all";

const needsReview = (r: TranslationRow) => r.translation?.status !== "approved";

function StatusBadge({ row }: { row: TranslationRow }) {
  const tr = row.translation;
  if (!tr) {
    return <Badge tone="amber" icon={<ShieldAlert className="size-3.5" />} text="Not translated" />;
  }
  if (tr.status === "approved") {
    return <Badge tone="green" icon={<CircleCheck className="size-3.5" />} text={`Reviewed by ${tr.reviewed_by ?? "staff"}`} />;
  }
  return (
    <>
      <Badge tone="amber" icon={<ShieldAlert className="size-3.5" />} text="Needs review" />
      {tr.is_mock && <Badge tone="slate" icon={<FlaskConical className="size-3.5" />} text="Mock text" />}
    </>
  );
}

function Badge({ tone, icon, text }: { tone: "green" | "amber" | "slate"; icon: ReactNode; text: string }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      <span aria-hidden>{icon}</span>
      {text}
    </span>
  );
}

/** Live check of the placeholders the dose renderer needs, as the reviewer types. */
function PlaceholderHints({ row, text }: { row: TranslationRow; text: string }) {
  if (row.placeholders.length === 0) return null;
  if (row.translation?.uses_fallback) {
    return (
      <p className="flex gap-2 text-sm text-slate-500">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Fallback wording: the values appear as digits in the patient's box, so no placeholders are needed here.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-slate-500">Keep exactly once:</span>
      {row.placeholders.map((p) => {
        const count = text.split(`{${p}}`).length - 1;
        const ok = count === 1;
        return (
          <span
            key={p}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs ${
              ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            {ok ? <Check aria-hidden className="size-3" /> : <CircleAlert aria-hidden className="size-3" />}
            {`{${p}}`}
            <span className="sr-only">{ok ? " present" : count === 0 ? " missing" : " repeated"}</span>
          </span>
        );
      })}
    </div>
  );
}

function RowCard({ row, onSaved }: { row: TranslationRow; onSaved: (r: TranslationRow) => void }) {
  const tr = row.translation;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tr?.text ?? "");
  const [saving, setSaving] = useState<null | "save" | "approve" | "unapprove">(null);
  const [error, setError] = useState<string | null>(null);
  const textId = `tr-${row.template_key}`;

  async function submit(body: { text?: string; approve?: boolean }, action: "save" | "approve" | "unapprove") {
    if (!tr) return;
    setSaving(action);
    setError(null);
    try {
      const updated = await api.patch<TranslationRow>(`/api/translations/${tr.id}/`, body);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(apiErr?.fields.text?.[0] ?? apiErr?.fields.approve?.[0] ?? apiErr?.message ?? "Could not save.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <li className={`${card} p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">{row.title}</h3>
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{row.template_key}</code>
        <span className="flex flex-wrap gap-1.5 sm:ml-auto">
          <StatusBadge row={row} />
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">English</p>
          <p className="mt-1 text-slate-700">{row.english_text}</p>
        </div>
        <div>
          {editing ? (
            <label htmlFor={textId} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Swahili
            </label>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Swahili</p>
          )}
          {!tr ? (
            <p className="mt-1 text-sm text-slate-500">Run translate_templates to create it.</p>
          ) : editing ? (
            <textarea
              id={textId}
              lang="sw"
              rows={3}
              maxLength={1000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${textId}-error` : undefined}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 aria-[invalid=true]:border-red-500"
            />
          ) : (
            <p lang="sw" className="mt-1 text-slate-900">
              {tr.text}
            </p>
          )}
        </div>
      </div>

      {tr && (
        <div className="mt-4 space-y-3">
          {editing && <PlaceholderHints row={row} text={draft} />}
          {error && (
            <p id={`${textId}-error`} role="alert" className={fieldError}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <button type="button" className={btnPrimary} disabled={saving !== null} onClick={() => submit({ text: draft, approve: true }, "approve")}>
                  {saving === "approve" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <CircleCheck aria-hidden className="size-4" />}
                  Save and approve
                </button>
                <button type="button" className={btnSecondary} disabled={saving !== null} onClick={() => submit({ text: draft }, "save")}>
                  {saving === "save" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                  Save
                </button>
                <button
                  type="button"
                  className="min-h-10 px-3 text-sm text-slate-600 hover:text-slate-900"
                  disabled={saving !== null}
                  onClick={() => {
                    setEditing(false);
                    setDraft(tr.text);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setDraft(tr.text);
                    setEditing(true);
                  }}
                >
                  <Pencil aria-hidden className="size-4" />
                  Edit
                </button>
                {tr.status === "approved" ? (
                  <button type="button" className={btnSecondary} disabled={saving !== null} onClick={() => submit({ approve: false }, "unapprove")}>
                    {saving === "unapprove" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
                    Undo approval
                  </button>
                ) : (
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={saving !== null || tr.is_mock}
                    title={tr.is_mock ? "Mock text cannot be approved. Edit it into real Swahili first." : undefined}
                    onClick={() => submit({ approve: true }, "approve")}
                  >
                    {saving === "approve" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <CircleCheck aria-hidden className="size-4" />}
                    Approve
                  </button>
                )}
                {tr.is_mock && tr.status !== "approved" && (
                  <span className="text-sm text-slate-500">Mock text: edit it into real Swahili to approve.</span>
                )}
                {tr.reviewed_at && <span className="text-sm text-slate-500 sm:ml-auto">Reviewed {formatDateTime(tr.reviewed_at)}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function Translations() {
  const [filter, setFilter] = useState<Filter>("review");
  const { data, error, loading, reload, setData } = useApi<TranslationListResponse>("/api/translations/");

  const rows = data?.translations ?? [];
  const approvedCount = rows.filter((r) => !needsReview(r)).length;
  const visible = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : filter === "review" ? needsReview(r) : !needsReview(r))),
    [rows, filter],
  );

  function replaceRow(updated: TranslationRow) {
    setData((prev) => prev && { translations: prev.translations.map((r) => (r.template_key === updated.template_key ? updated : r)) });
  }

  const tab = (value: Filter, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={filter === value}
      onClick={() => setFilter(value)}
      className={`min-h-10 rounded-lg px-4 text-sm font-medium transition ${
        filter === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {text}
    </button>
  );

  const section = (kind: TranslationRow["kind"], heading: string, hint: string) => {
    const items = visible.filter((r) => r.kind === kind);
    if (items.length === 0) return null;
    return (
      <section aria-labelledby={`h-${kind}`} className="space-y-3">
        <div>
          <h2 id={`h-${kind}`} className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {heading}
          </h2>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
        <ul className="grid gap-4 2xl:grid-cols-2">
          {items.map((r) => (
            <RowCard key={r.template_key} row={r} onSaved={replaceRow} />
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Translations</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            A fluent Swahili reader checks each sentence before patients rely on it. Edits are kept even if the
            templates are translated again.
          </p>
          {data && (
            <p className="mt-2 text-sm font-medium text-slate-700">
              {approvedCount} of {rows.length} reviewed
            </p>
          )}
        </div>
        <div role="tablist" aria-label="Filter translations" className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {tab("review", "Needs review")}
          {tab("approved", "Reviewed")}
          {tab("all", "All")}
        </div>
      </div>

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data &&
        (visible.length === 0 ? (
          <EmptyState title={filter === "review" ? "Everything is reviewed" : "Nothing here yet"} />
        ) : (
          <>
            {section("instruction", "Instructions", "Sentences read and spoken to the patient.")}
            {section("label", "Patient screen labels", "Buttons, headings and messages on the patient's phone.")}
          </>
        ))}
    </div>
  );
}
