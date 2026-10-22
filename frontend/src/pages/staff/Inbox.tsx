import { ArrowLeft, Check, CheckCheck, CircleAlert, ExternalLink, FlaskConical, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { AllCaughtUp } from "../../components/Illustrations";
import { ErrorState, LoadingState } from "../../components/StateViews";
import { useToast } from "../../components/Toaster";
import { VoiceNote } from "../../components/VoiceNote";
import { btnPrimary, chip, chipTone } from "../../components/ui";
import { api } from "../../lib/api";
import { notifyRepliesChanged } from "../../lib/events";
import { formatRelative } from "../../lib/format";
import type { Reply, ReplyListResponse } from "../../lib/types";
import { useApi } from "../../lib/useApi";

type Filter = "unresolved" | "all";

const POLL_MS = 15_000; // new patient replies show up without a reload

interface Conversation {
  instructionId: number;
  patientLabel: string;
  replies: Reply[]; // oldest first, like a chat
  last: Reply;
  unresolved: number;
}

/** One conversation per instruction (a patient's link), unresolved first, then most recent. */
function groupConversations(replies: Reply[]): Conversation[] {
  const byInstruction = new Map<number, Reply[]>();
  for (const r of replies) {
    const list = byInstruction.get(r.instruction_id) ?? [];
    list.push(r);
    byInstruction.set(r.instruction_id, list);
  }
  const conversations = [...byInstruction.entries()].map(([instructionId, list]) => {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = sorted[sorted.length - 1]!;
    return {
      instructionId,
      patientLabel: last.patient_label,
      replies: sorted,
      last,
      unresolved: sorted.filter((r) => !r.is_resolved).length,
    };
  });
  return conversations.sort(
    (a, b) => Number(b.unresolved > 0) - Number(a.unresolved > 0) || b.last.created_at.localeCompare(a.last.created_at),
  );
}

function Avatar({ label, size = "md" }: { label: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-primary-soft font-display font-semibold text-primary ${
        size === "lg" ? "size-12 text-lg" : "size-10 text-base"
      }`}
    >
      {label.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function ConversationRow({ c, active, onOpen }: { c: Conversation; active: boolean; onOpen: () => void }) {
  const snippet = c.last.status === "failed" ? "Translation failed" : c.last.translated_text;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition duration-200 ${active ? "bg-primary-soft" : "hover:translate-x-0.5 hover:bg-surface-2"}`}
      >
        <Avatar label={c.patientLabel} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate ${c.unresolved ? "font-semibold text-ink" : "font-medium text-ink/80"}`}>
              {c.patientLabel}
              {c.last.is_demo && <span className="ml-1.5 text-xs font-medium text-primary">Demo</span>}
            </span>
            <span className="shrink-0 text-xs text-muted">{formatRelative(c.last.created_at)}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm ${c.last.status === "failed" ? "text-danger" : "text-muted"}`}>{snippet}</span>
            {c.unresolved > 0 && (
              <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-saffron px-1.5 text-[11px] leading-5 font-bold text-on-saffron tabular-nums">
                {c.unresolved}
                <span className="sr-only"> unresolved</span>
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function Bubble({ reply, busy, onToggle }: { reply: Reply; busy: boolean; onToggle: (r: Reply) => void }) {
  const failed = reply.status === "failed";
  return (
    <li className="flex max-w-2xl flex-col gap-2">
      <div className={`rounded-2xl rounded-tl-md border bg-surface p-4 shadow-lift ${failed ? "border-danger/40" : "border-line"}`}>
        <VoiceNote id={reply.id} src={reply.audio_url} label={`voice note from ${reply.patient_label}`} />
        <div className="mt-3 border-t border-line pt-3">
          {failed ? (
            <p className="flex gap-2 text-sm text-danger-ink">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {reply.error || "The reply could not be translated."} Listen to the original recording above.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-muted">English translation</p>
              <p className="mt-1 leading-relaxed text-ink">{reply.translated_text}</p>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-muted">
        <span>{formatRelative(reply.created_at)}</span>
        {reply.is_mock && (
          <span className={`${chip} ${chipTone.neutral}`}>
            <FlaskConical aria-hidden className="size-3" />
            Mock
          </span>
        )}
        {reply.is_demo && (
          <span className={`${chip} ${chipTone.primary}`} title="Sent from the public demo patient on the landing page">
            Demo
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggle(reply)}
          disabled={busy}
          aria-busy={busy}
          className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 font-semibold transition disabled:opacity-60 ${
            reply.is_resolved ? "text-leaf-ink hover:bg-leaf-soft" : "text-primary hover:bg-primary-soft"
          }`}
        >
          {busy ? (
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          ) : reply.is_resolved ? (
            <CheckCheck aria-hidden className="size-3.5" />
          ) : (
            <Check aria-hidden className="size-3.5" />
          )}
          {reply.is_resolved ? "Resolved" : "Mark resolved"}
        </button>
      </div>
    </li>
  );
}

function Thread({
  c,
  pending,
  onBack,
  onToggle,
  onResolveAll,
}: {
  c: Conversation;
  pending: Set<number>;
  onBack: () => void;
  onToggle: (r: Reply) => void;
  onResolveAll: (c: Conversation) => void;
}) {
  const resolvingAny = c.replies.some((r) => !r.is_resolved && pending.has(r.id));
  return (
    <section aria-labelledby="thread-heading" className="flex min-w-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="grid size-10 place-items-center rounded-xl hover:bg-surface-2 lg:hidden">
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <Avatar label={c.patientLabel} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id="thread-heading" className="truncate font-display text-lg font-semibold text-ink">
            {c.patientLabel}
          </h2>
          <Link to={`/instructions/${c.instructionId}`} viewTransition className="-ml-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary hover:underline">
            Open instruction
            <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        </div>
        {c.unresolved > 0 ? (
          <button type="button" onClick={() => onResolveAll(c)} disabled={resolvingAny} className={btnPrimary}>
            {resolvingAny ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <CheckCheck aria-hidden className="size-4" />}
            Resolve {c.unresolved > 1 ? `all ${c.unresolved}` : ""}
          </button>
        ) : (
          <span className={`${chip} ${chipTone.good}`}>
            <CheckCheck aria-hidden className="size-3.5" />
            All resolved
          </span>
        )}
      </header>
      <ol aria-label={`Voice notes from ${c.patientLabel}`} className="flex flex-col gap-6 py-6">
        {c.replies.map((r) => (
          <Bubble key={r.id} reply={r} busy={pending.has(r.id)} onToggle={onToggle} />
        ))}
      </ol>
      <p className="border-t border-line pt-4 text-sm text-muted">
        Patients cannot be answered here. Call or see them at the clinic, then mark the reply resolved.
      </p>
    </section>
  );
}

export function Inbox() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("unresolved");
  const [pending, setPending] = useState<Set<number>>(new Set()); // reply ids waiting on the server
  const [confirmAll, setConfirmAll] = useState<Conversation | null>(null);
  const { data, error, loading, reload, setData } = useApi<ReplyListResponse>("/api/replies/", { pollMs: POLL_MS });

  const all = useMemo(() => groupConversations(data?.replies ?? []), [data]);
  const conversations = filter === "unresolved" ? all.filter((c) => c.unresolved > 0) : all;
  const selectedId = Number(params.get("c")) || null;
  // Desktop opens the first conversation by default; phones show the list until one is tapped.
  const selected = all.find((c) => c.instructionId === selectedId) ?? null;
  const desktopSelected = selected ?? conversations[0] ?? null;

  function open(c: Conversation) {
    setParams({ c: String(c.instructionId) });
  }

  function patch(ids: number[], resolved: boolean) {
    setData((prev) => prev && { replies: prev.replies.map((r) => (ids.includes(r.id) ? { ...r, is_resolved: resolved } : r)) });
  }

  async function setResolved(ids: number[], resolved: boolean) {
    await Promise.all(ids.map((id) => api.post<Reply>(`/api/replies/${id}/resolve/`, { resolved })));
    notifyRepliesChanged();
  }

  /**
   * The row shows a spinner until the server confirms, then changes, with Undo in the toast.
   * Undo itself is optimistic (the toast is gone by then); a failed undo reloads the real state.
   */
  async function change(ids: number[], resolved: boolean, message: string) {
    setPending((prev) => new Set([...prev, ...ids]));
    try {
      await setResolved(ids, resolved);
      patch(ids, resolved);
      toast({
        tone: "success",
        message,
        action: {
          label: "Undo",
          onClick: () => {
            patch(ids, !resolved);
            setResolved(ids, !resolved).catch(() => {
              toast({ tone: "error", message: "Could not undo. Try again." });
              reload();
            });
          },
        },
      });
    } catch {
      toast({ tone: "error", message: "Could not update the reply. Check your connection and try again." });
      reload();
    } finally {
      setPending((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    }
  }

  const unresolvedIds = (c: Conversation) => c.replies.filter((r) => !r.is_resolved).map((r) => r.id);
  const toggle = (r: Reply) => void change([r.id], !r.is_resolved, r.is_resolved ? "Reply reopened" : "Reply resolved");
  // Several replies at once asks first; a single one goes straight through (Undo covers it).
  const resolveAll = (c: Conversation) => {
    const ids = unresolvedIds(c);
    if (ids.length > 1) setConfirmAll(c);
    else void change(ids, true, "Reply resolved");
  };
  async function confirmResolveAll() {
    if (!confirmAll) return;
    const ids = unresolvedIds(confirmAll);
    await change(ids, true, `${ids.length} replies resolved`);
    setConfirmAll(null);
  }

  const tab = (value: Filter, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={filter === value}
      onClick={() => setFilter(value)}
      className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-medium transition ${
        filter === value ? "bg-surface text-ink shadow-lift" : "text-muted hover:text-ink"
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-6">
      <header className={selected ? "hidden lg:block" : ""}>
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">Inbox</h1>
        <p className="mt-1 text-muted">Voice notes from patients, in English.</p>
      </header>

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={reload} />}

      {data &&
        (all.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AllCaughtUp className="w-32" />
            <p className="font-display text-lg font-semibold text-ink">No voice notes yet</p>
            <p className="max-w-sm text-sm text-muted">When a patient records a question on their instruction page, it arrives here within seconds.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-0 lg:divide-x lg:divide-line lg:border-t lg:border-line">
            {/* Conversation list: always on desktop; on phones only until a conversation is open. */}
            <nav aria-label="Conversations" className={`space-y-3 lg:pt-4 lg:pr-4 ${selected ? "hidden lg:block" : ""}`}>
              <div role="tablist" aria-label="Filter conversations" className="flex gap-1 rounded-xl bg-surface-2 p-1">
                {tab("unresolved", "Unresolved")}
                {tab("all", "All")}
              </div>
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AllCaughtUp className="w-24" />
                  <p className="text-sm text-muted">Nothing waiting. Everything has been resolved.</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {conversations.map((c) => (
                    <ConversationRow
                      key={c.instructionId}
                      c={c}
                      active={desktopSelected?.instructionId === c.instructionId}
                      onOpen={() => open(c)}
                    />
                  ))}
                </ul>
              )}
            </nav>

            <div className={`lg:pt-4 lg:pl-8 ${selected ? "" : "hidden lg:block"}`}>
              {desktopSelected ? (
                <Thread c={selected ?? desktopSelected} pending={pending} onBack={() => setParams({})} onToggle={toggle} onResolveAll={resolveAll} />
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-center text-muted">
                  <AllCaughtUp className="w-28" />
                  <p>Pick a conversation to listen.</p>
                </div>
              )}
            </div>
          </div>
        ))}

      <ConfirmDialog
        open={confirmAll !== null}
        title={`Resolve all ${confirmAll ? unresolvedIds(confirmAll).length : ""} replies from ${confirmAll?.patientLabel ?? ""}?`}
        confirmLabel="Resolve all"
        Icon={CheckCheck}
        busy={confirmAll !== null && unresolvedIds(confirmAll).some((id) => pending.has(id))}
        onConfirm={() => void confirmResolveAll()}
        onCancel={() => setConfirmAll(null)}
      >
        Only do this once you have listened to every voice note and followed up with the patient. You can reopen a reply afterwards.
      </ConfirmDialog>
    </div>
  );
}
