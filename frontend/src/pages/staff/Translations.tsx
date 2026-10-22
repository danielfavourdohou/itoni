import { ArrowLeft, Check, CircleAlert, CircleCheck, FlaskConical, Info, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/StateViews";
import { useToast } from "../../components/Toaster";
import { btnPrimary, btnSecondary, chip, chipTone, fieldError } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { formatRelative } from "../../lib/format";
import type { TranslationListResponse, TranslationRow } from "../../lib/types";
import { useApi } from "../../lib/useApi";

type Filter = "review" | "approved" | "all";

const needsReview = (r: TranslationRow) => r.translation?.status !== "approved";

function StatusDot({ row }: { row: TranslationRow }) {
  const tr = row.translation;
  const tone = !tr ? "bg-danger" : tr.status === "approved" ? "bg-leaf" : tr.is_mock ? "bg-muted/60" : "bg-saffron";
  const text = !tr ? "Not translated" : tr.status === "approved" ? "Reviewed" : tr.is_mock ? "Mock text" : "Needs review";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden className={`size-2 rounded-full ${tone}`} />
      {text}
    </span>
  );
}

/** Live check of the placeholders the dose renderer needs, as the reviewer types. */
function PlaceholderHints({ row, text }: { row: TranslationRow; text: string }) {
  if (row.placeholders.length === 0) return null;
  if (row.translation?.uses_fallback) {
    return (
      <p className="flex gap-2 text-sm text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Fallback wording: the values appear as digits on the patient's screen, so no placeholders are needed here.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted">Keep exactly once:</span>
      {row.placeholders.map((p) => {
        const count = text.split(`{${p}}`).length - 1;
        const ok = count === 1;
        return (
          <span key={p} className={`${chip} font-mono ${ok ? chipTone.good : chipTone.saffron}`}>
            {ok ? <Check aria-hidden className="size-3" /> : <CircleAlert aria-hidden className="size-3" />}
            {`{${p}}`}
            <span className="sr-only">{ok ? " present" : count === 0 ? " missing" : " repeated"}</span>
          </span>
        );
      })}
    </div>
  );
}

function Editor({
  row,
  onSaved,
  onApproved,
  onBack,
}: {
  row: TranslationRow;
  onSaved: (r: TranslationRow) => void;
  onApproved: (r: TranslationRow, previous: TranslationRow) => void;
  onBack: () => void;
}) {
  const tr = row.translation;
  const [draft, setDraft] = useState(tr?.text ?? "");
  const [saving, setSaving] = useState<null | "save" | "approve" | "unapprove">(null);
  const [error, setError] = useState<string | null>(null);
  const changed = draft.trim() !== (tr?.text ?? "");

  // A different template was picked: start from its stored text.
  useEffect(() => {
    setDraft(row.translation?.text ?? "");
    setError(null);
  }, [row.template_key, row.translation?.text]);

  async function submit(body: { text?: string; approve?: boolean }, action: "save" | "approve" | "unapprove") {
    if (!tr) return;
    setSaving(action);
    setError(null);
    try {
      const updated = await api.patch<TranslationRow>(`/api/translations/${tr.id}/`, body);
      if (action === "approve") onApproved(updated, row);
      else onSaved(updated);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(apiErr?.fields.text?.[0] ?? apiErr?.fields.approve?.[0] ?? apiErr?.message ?? "Could not save.");
    } finally {
      setSaving(null);
    }
  }

  const approveDisabled = saving !== null || (tr?.is_mock === true && !changed);
  return (
    <section aria-labelledby="editor-heading" className="min-w-0 space-y-6">
      <header className="flex items-start gap-3 border-b border-line pb-4">
        <button type="button" onClick={onBack} aria-label="Back to the list" className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-surface-2 lg:hidden">
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 id="editor-heading" className="font-display text-lg font-semibold text-ink">
            {row.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <StatusDot row={row} />
            <code className="text-xs text-muted">{row.template_key}</code>
            {tr?.reviewed_at && (
              <span className="text-xs text-muted">
                Reviewed by {tr.reviewed_by ?? "staff"}, {formatRelative(tr.reviewed_at)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div>
        <p className="text-sm text-muted">English</p>
        <p className="mt-1 text-lg leading-relaxed text-ink">{row.english_text}</p>
      </div>

      {!tr ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink">Not translated yet. Run translate_templates to create it.</p>
      ) : (
        <div className="space-y-3">
          <label htmlFor="swahili-text" className="text-sm text-muted">
            Swahili
          </label>
          <textarea
            id="swahili-text"
            lang="sw"
            rows={4}
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "swahili-error" : undefined}
            className="block w-full rounded-xl border border-line bg-surface px-4 py-3 font-display text-lg leading-relaxed text-ink transition hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none aria-[invalid=true]:border-danger"
          />
          <PlaceholderHints row={row} text={draft} />
          {tr.is_mock && !changed && (
            <p className="flex gap-2 text-sm text-muted">
              <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
              This is mock text. Write the real Swahili (or run the live translation) before approving.
            </p>
          )}
          {error && (
            <p id="swahili-error" role="alert" className={fieldError}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {tr.status === "approved" && !changed ? (
              <button type="button" className={btnSecondary} disabled={saving !== null} onClick={() => submit({ approve: false }, "unapprove")}>
                {saving === "unapprove" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
                Undo approval
              </button>
            ) : (
              <button
                type="button"
                className={btnPrimary}
                disabled={approveDisabled}
                onClick={() => submit(changed ? { text: draft, approve: true } : { approve: true }, "approve")}
              >
                {saving === "approve" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <CircleCheck aria-hidden className="size-4" />}
                {changed ? "Save and approve" : "Approve"}
              </button>
            )}
            {changed && (
              <>
                <button type="button" className={btnSecondary} disabled={saving !== null} onClick={() => submit({ text: draft }, "save")}>
                  {saving === "save" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                  Save without approving
                </button>
                <button type="button" className="min-h-10 rounded-lg px-3 text-sm text-muted hover:text-ink" onClick={() => setDraft(tr.text)}>
                  Discard changes
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function Translations() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("review");
  const { data, error, loading, reload, setData } = useApi<TranslationListResponse>("/api/translations/");

  const rows = data?.translations ?? [];
  const approvedCount = rows.filter((r) => !needsReview(r)).length;
  const visible = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : filter === "review" ? needsReview(r) : !needsReview(r))),
    [rows, filter],
  );
  const selectedKey = params.get("t");
  const selected = rows.find((r) => r.template_key === selectedKey) ?? null;
  const shown = selected ?? visible[0] ?? null;

  function replaceRow(updated: TranslationRow) {
    setData((prev) => prev && { translations: prev.translations.map((r) => (r.template_key === updated.template_key ? updated : r)) });
  }

  function saved(updated: TranslationRow) {
    replaceRow(updated);
    toast({ tone: "success", message: "Saved" });
  }

  /** Approve, then move the reviewer on to the next item that still needs review. Undo restores it. */
  function approved(updated: TranslationRow, previous: TranslationRow) {
    replaceRow(updated);
    const next = rows.find((r) => r.template_key !== updated.template_key && needsReview(r));
    if (next) setParams({ t: next.template_key });
    toast({
      tone: "success",
      message: `${updated.title} approved`,
      action: {
        label: "Undo",
        onClick: () => {
          const id = updated.translation?.id;
          if (!id) return;
          api.patch<TranslationRow>(`/api/translations/${id}/`, { approve: false }).then(
            (reverted) => {
              replaceRow(reverted);
              setParams({ t: previous.template_key });
            },
            () => toast({ tone: "error", message: "Could not undo. Use Undo approval on the item." }),
          );
        },
      },
    });
  }

  const tab = (value: Filter, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={filter === value}
      onClick={() => setFilter(value)}
      className={`min-h-9 flex-1 rounded-lg px-2 text-sm font-medium transition ${
        filter === value ? "bg-surface text-ink shadow-lift" : "text-muted hover:text-ink"
      }`}
    >
      {text}
    </button>
  );

  const group = (kind: TranslationRow["kind"], heading: string) => {
    const items = visible.filter((r) => r.kind === kind);
    if (items.length === 0) return null;
    return (
      <div>
        <p className="px-3 pt-4 pb-1 text-xs font-medium text-muted">{heading}</p>
        <ul className="space-y-0.5">
          {items.map((r) => {
            const active = shown?.template_key === r.template_key;
            return (
              <li key={r.template_key}>
                <button
                  type="button"
                  onClick={() => setParams({ t: r.template_key })}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-primary-soft" : "hover:bg-surface-2"}`}
                >
                  <span className="text-sm font-semibold text-ink">{r.title}</span>
                  <StatusDot row={r} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className={selected ? "hidden lg:block" : ""}>
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">Translations</h1>
        <p className="mt-1 text-muted">Every sentence checked by a fluent Swahili reader.</p>
        {data && (
          <div className="mt-4 max-w-md">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-ink">
                {approvedCount} of {rows.length} reviewed
              </span>
              <span className="text-muted tabular-nums">{rows.length ? Math.round((approvedCount / rows.length) * 100) : 0}%</span>
            </div>
            <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-leaf transition-[width] duration-500" style={{ width: `${rows.length ? (approvedCount / rows.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </header>

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={reload} />}

      {data && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-0 lg:divide-x lg:divide-line lg:border-t lg:border-line">
          <nav aria-label="Templates" className={`lg:pt-4 lg:pr-4 ${selected ? "hidden lg:block" : ""}`}>
            <div role="tablist" aria-label="Filter translations" className="flex gap-1 rounded-xl bg-surface-2 p-1">
              {tab("review", "To review")}
              {tab("approved", "Reviewed")}
              {tab("all", "All")}
            </div>
            {visible.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted">{filter === "review" ? "Everything is reviewed." : "Nothing here yet."}</p>
            ) : (
              <>
                {group("instruction", "Instructions")}
                {group("label", "Patient screen labels")}
              </>
            )}
          </nav>
          <div className={`lg:pt-4 lg:pl-8 ${selected ? "" : "hidden lg:block"}`}>
            {shown ? (
              <Editor row={shown} onSaved={saved} onApproved={approved} onBack={() => setParams({})} />
            ) : (
              <p className="py-20 text-center text-muted">Pick a template to review.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
