import { ArrowLeft, Check, CheckCheck, CircleAlert, ExternalLink, FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

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

function Bubble({ reply, onToggle }: { reply: Reply; onToggle: (r: Reply) => void }) {
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
          className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 font-semibold transition ${
            reply.is_resolved ? "text-leaf-ink hover:bg-leaf-soft" : "text-primary hover:bg-primary-soft"
          }`}
        >
          {reply.is_resolved ? <CheckCheck aria-hidden className="size-3.5" /> : <Check aria-hidden className="size-3.5" />}
          {reply.is_resolved ? "Resolved" : "Mark resolved"}
        </button>
      </div>
    </li>
  );
}

function Thread({
  c,
  onBack,
  onToggle,
  onResolveAll,
}: {
  c: Conversation;
  onBack: () => void;
  onToggle: (r: Reply) => void;
  onResolveAll: (c: Conversation) => void;
}) {
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
          <button type="button" onClick={() => onResolveAll(c)} className={btnPrimary}>
            <CheckCheck aria-hidden className="size-4" />
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
          <Bubble key={r.id} reply={r} onToggle={onToggle} />
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

  /** Optimistic change with an Undo toast; on failure the real state is reloaded. */
  function change(ids: number[], resolved: boolean, message: string) {
    patch(ids, resolved);
    setResolved(ids, resolved).then(
      () =>
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
        }),
      () => {
        toast({ tone: "error", message: "Could not update the reply. Check your connection and try again." });
        reload();
      },
    );
  }

  const toggle = (r: Reply) => change([r.id], !r.is_resolved, r.is_resolved ? "Reply reopened" : "Reply resolved");
  const resolveAll = (c: Conversation) => {
    const ids = c.replies.filter((r) => !r.is_resolved).map((r) => r.id);
    change(ids, true, ids.length > 1 ? `${ids.length} replies resolved` : "Reply resolved");
  };

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
                <Thread c={selected ?? desktopSelected} onBack={() => setParams({})} onToggle={toggle} onResolveAll={resolveAll} />
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-center text-muted">
                  <AllCaughtUp className="w-28" />
                  <p>Pick a conversation to listen.</p>
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
