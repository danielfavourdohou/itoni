import { Check, ChevronRight, Inbox as InboxIcon, Plus, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { MiniPlayer } from "../../components/MiniPlayer";
import { ErrorState, LoadingState } from "../../components/StateViews";
import { useToast } from "../../components/Toaster";
import { btnSecondary, chip, chipTone } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { notifyRepliesChanged } from "../../lib/events";
import { formatDate, formatRelative, greeting } from "../../lib/format";
import type { DashboardResponse, InstructionSummary, Reply, ReplyListResponse } from "../../lib/types";
import { useApi } from "../../lib/useApi";

const QUEUE_LIMIT = 5;
const POLL_MS = 20_000;

function SectionHeading({ title, count, to, toLabel }: { title: string; count?: number; to?: string; toLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
      <h2 className="font-display text-lg font-semibold text-ink">
        {title}
        {count !== undefined && count > 0 && <span className="ml-2 text-base font-normal text-muted tabular-nums">{count}</span>}
      </h2>
      {to && (
        <Link to={to} viewTransition className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary-soft">
          {toLabel}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}

function QueueRow({ reply, onResolve }: { reply: Reply; onResolve: (r: Reply) => void }) {
  const failed = reply.status === "failed";
  return (
    <li className="flex items-start gap-4 py-4">
      <MiniPlayer src={reply.audio_url} label={`reply from ${reply.patient_label}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <Link to="/inbox" viewTransition className="inline-flex min-h-9 items-center font-semibold text-ink hover:text-primary">
            {reply.patient_label}
          </Link>
          <span className="text-sm text-muted">{formatRelative(reply.created_at)}</span>
        </div>
        <p className={`mt-1 line-clamp-2 ${failed ? "text-danger" : "text-ink/90"}`}>
          {failed ? "Translation failed. Listen to the original recording." : `“${reply.translated_text}”`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onResolve(reply)}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-ink transition hover:border-leaf hover:bg-leaf-soft hover:text-leaf-ink active:scale-95"
      >
        <Check aria-hidden className="size-4" />
        <span className="hidden sm:inline">Resolve</span>
        <span className="sr-only sm:hidden">Resolve reply from {reply.patient_label}</span>
      </button>
    </li>
  );
}

function InstructionRow({ instruction }: { instruction: InstructionSummary }) {
  return (
    <li>
      <Link
        to={`/instructions/${instruction.id}`}
        viewTransition
        className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 transition hover:bg-surface"
      >
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-base font-semibold text-primary">
          {instruction.patient_label.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{instruction.patient_label}</span>
          <span className="block text-sm text-muted">
            {instruction.item_count} {instruction.item_count === 1 ? "instruction" : "instructions"}
            {instruction.follow_up_date && <span className="ml-2 whitespace-nowrap">Back {formatDate(instruction.follow_up_date)}</span>}
          </span>
        </span>
        <span className="hidden flex-col items-end gap-1 sm:flex">
          <span className="text-sm text-muted">{formatRelative(instruction.created_at)}</span>
          {instruction.is_expired ? (
            <span className={`${chip} ${chipTone.neutral}`}>Link expired</span>
          ) : (
            instruction.has_unreviewed && (
              <span className={`${chip} ${chipTone.saffron}`}>
                <ShieldAlert aria-hidden className="size-3.5" />
                Unreviewed
              </span>
            )
          )}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </li>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const dash = useApi<DashboardResponse>("/api/dashboard/", { pollMs: POLL_MS });
  const queue = useApi<ReplyListResponse>("/api/replies/?resolved=false", { pollMs: POLL_MS });

  async function setResolved(reply: Reply, resolved: boolean) {
    await api.post<Reply>(`/api/replies/${reply.id}/resolve/`, { resolved });
    notifyRepliesChanged();
  }

  function resolve(reply: Reply) {
    // Optimistic: the row leaves at once; Undo puts it back and reopens it on the server.
    queue.setData((prev) => prev && { replies: prev.replies.filter((r) => r.id !== reply.id) });
    setResolved(reply, true).then(
      () =>
        toast({
          tone: "success",
          message: `Reply from ${reply.patient_label} resolved`,
          action: {
            label: "Undo",
            onClick: () => {
              setResolved(reply, false).then(queue.reload, () => toast({ tone: "error", message: "Could not undo. Reopen it from the Inbox." }));
            },
          },
        }),
      () => {
        toast({ tone: "error", message: "Could not resolve the reply. Check your connection and try again." });
        queue.reload();
      },
    );
  }

  const replies = queue.data?.replies ?? [];
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{today}</p>
          <h1 className="mt-1 font-display text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">
            {greeting()}, {user?.username}
          </h1>
        </div>
        <Link
          to="/instructions/new"
          viewTransition
          className="group inline-flex min-h-12 items-center gap-3 self-start rounded-2xl bg-primary py-3 pr-6 pl-3 text-on-primary shadow-lift transition hover:bg-primary-strong active:scale-[0.98] sm:self-auto"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-saffron text-on-saffron transition group-hover:rotate-90">
            <Plus aria-hidden className="size-5" />
          </span>
          <span className="text-left">
            <span className="block text-base font-semibold">New instruction</span>
            <span className="block text-xs opacity-80">Swahili text, audio and a QR code</span>
          </span>
        </Link>
      </header>

      <div className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="queue-heading">
          <div id="queue-heading">
            <SectionHeading title="Waiting for you" count={replies.length} to="/inbox" toLabel="Open inbox" />
          </div>
          {queue.loading && !queue.data && <LoadingState />}
          {queue.error && <div className="pt-4"><ErrorState message={queue.error.message} onRetry={queue.reload} /></div>}
          {queue.data &&
            (replies.length === 0 ? (
              <div className="flex items-center gap-4 py-8 text-muted">
                <span className="grid size-11 place-items-center rounded-full bg-leaf-soft text-leaf-ink">
                  <InboxIcon aria-hidden className="size-5" />
                </span>
                <p>Nothing waiting. When a patient records a question, it appears here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {replies.slice(0, QUEUE_LIMIT).map((r) => (
                  <QueueRow key={r.id} reply={r} onResolve={resolve} />
                ))}
              </ul>
            ))}
          {replies.length > QUEUE_LIMIT && (
            <Link to="/inbox" viewTransition className={`${btnSecondary} mt-2 w-full`}>
              See all {replies.length} in the inbox
            </Link>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <div id="recent-heading">
            <SectionHeading title="Recent instructions" />
          </div>
          {dash.loading && !dash.data && <LoadingState />}
          {dash.error && <div className="pt-4"><ErrorState message={dash.error.message} onRetry={dash.reload} /></div>}
          {dash.data &&
            (dash.data.recent_instructions.length === 0 ? (
              <div className="py-8 text-muted">
                No instructions yet.{" "}
                <Link to="/instructions/new" viewTransition className="font-semibold text-primary hover:underline">
                  Create the first one
                </Link>
                .
              </div>
            ) : (
              <ul className="pt-2">
                {dash.data.recent_instructions.map((i) => (
                  <InstructionRow key={i.id} instruction={i} />
                ))}
              </ul>
            ))}
        </section>
      </div>
    </div>
  );
}
