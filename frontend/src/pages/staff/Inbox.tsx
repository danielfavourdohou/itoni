import { CircleAlert, CircleCheck, FlaskConical, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { btnPrimary, btnSecondary, card } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { notifyRepliesChanged } from "../../lib/events";
import { formatDateTime } from "../../lib/format";
import type { Reply, ReplyListResponse } from "../../lib/types";
import { useApi } from "../../lib/useApi";

type Filter = "unresolved" | "all";

const POLL_MS = 15_000; // new patient replies show up without a reload

function ReplyCard({ reply, busy, onToggle }: { reply: Reply; busy: boolean; onToggle: (r: Reply) => void }) {
  const failed = reply.status === "failed";
  return (
    <li
      className={`${card} flex flex-col gap-4 p-5 ${reply.is_resolved ? "opacity-75" : ""} ${
        failed ? "border-red-200" : !reply.is_resolved ? "border-l-4 border-l-teal-700" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={`/instructions/${reply.instruction_id}`} className="inline-flex min-h-10 items-center font-semibold text-slate-900 hover:text-teal-800 hover:underline">
          {reply.patient_label}
        </Link>
        <span className="text-sm text-slate-500">{formatDateTime(reply.created_at)}</span>
        <span className="flex flex-wrap gap-1.5 sm:ml-auto">
          {failed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
              <CircleAlert aria-hidden className="size-3.5" />
              Translation failed
            </span>
          )}
          {reply.is_mock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              <FlaskConical aria-hidden className="size-3.5" />
              Mock
            </span>
          )}
          {reply.is_resolved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <CircleCheck aria-hidden className="size-3.5" />
              Resolved
            </span>
          )}
        </span>
      </div>

      {failed ? (
        <p className="text-slate-700">
          {reply.error || "The reply could not be translated."} Listen to the original recording below.
        </p>
      ) : (
        <p className="text-lg leading-relaxed text-slate-900">{reply.translated_text}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <audio controls preload="none" src={reply.audio_url} className="w-full sm:flex-1">
          Your browser cannot play this recording.
        </audio>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(reply)}
          className={`${reply.is_resolved ? btnSecondary : btnPrimary} min-h-11 shrink-0`}
        >
          {reply.is_resolved ? <RotateCcw aria-hidden className="size-4" /> : <CircleCheck aria-hidden className="size-4" />}
          {reply.is_resolved ? "Reopen" : "Mark resolved"}
        </button>
      </div>
    </li>
  );
}

export function Inbox() {
  const [filter, setFilter] = useState<Filter>("unresolved");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const path = filter === "unresolved" ? "/api/replies/?resolved=false" : "/api/replies/";
  const { data, error, loading, reload, setData } = useApi<ReplyListResponse>(path, { pollMs: POLL_MS });

  async function toggle(reply: Reply) {
    const resolved = !reply.is_resolved;
    setBusyId(reply.id);
    setActionError(null);
    // Optimistic: the card updates (or leaves the Unresolved list) straight away.
    setData((prev) =>
      prev && {
        replies:
          filter === "unresolved" && resolved
            ? prev.replies.filter((r) => r.id !== reply.id)
            : prev.replies.map((r) => (r.id === reply.id ? { ...r, is_resolved: resolved } : r)),
      },
    );
    try {
      await api.post<Reply>(`/api/replies/${reply.id}/resolve/`, { resolved });
      notifyRepliesChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update the reply.");
      reload(); // put the real state back
    } finally {
      setBusyId(null);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            Patient voice replies, translated to English. A person reads every reply; nothing is answered automatically.
          </p>
        </div>
        <div role="tablist" aria-label="Filter replies" className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {tab("unresolved", "Unresolved")}
          {tab("all", "All")}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {actionError}
        </p>
      )}

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={reload} />}

      {data &&
        (data.replies.length === 0 ? (
          <EmptyState title={filter === "unresolved" ? "No unresolved replies" : "No replies yet"}>
            Replies appear here when a patient records a question on their instruction page. This list refreshes on its own.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {data.replies.map((r) => (
              <ReplyCard key={r.id} reply={r} busy={busyId === r.id} onToggle={toggle} />
            ))}
          </ul>
        ))}
    </div>
  );
}
