import { ChevronRight, Inbox, ListChecks, Plus, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { btnPrimary, card } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/format";
import type { DashboardResponse, InstructionSummary } from "../../lib/types";
import { useApi } from "../../lib/useApi";

function Stat({ icon, label, value, tone = "slate" }: { icon: ReactNode; label: string; value: number; tone?: "slate" | "amber" }) {
  return (
    <div className={`${card} flex items-center gap-4 p-4`}>
      <span
        aria-hidden
        className={`grid size-10 place-items-center rounded-lg ${
          tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700"
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function InstructionRow({ instruction }: { instruction: InstructionSummary }) {
  return (
    <li>
      <Link
        to={`/instructions/${instruction.id}`}
        className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{instruction.patient_label}</p>
          <p className="text-sm text-slate-500">
            {instruction.item_count} {instruction.item_count === 1 ? "instruction" : "instructions"}
            {instruction.follow_up_date && <> · back {formatDate(instruction.follow_up_date)}</>}
          </p>
        </div>
        <p className="hidden text-sm text-slate-500 sm:block">{formatDateTime(instruction.created_at)}</p>
        <div className="col-start-1 flex flex-wrap gap-1.5 sm:col-start-auto">
          {instruction.has_unreviewed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              <ShieldAlert aria-hidden className="size-3" />
              Unreviewed
            </span>
          )}
          {instruction.is_expired && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Link expired</span>
          )}
        </div>
        <ChevronRight aria-hidden className="col-start-2 row-span-2 row-start-1 size-4 text-slate-400 sm:col-start-auto sm:row-span-1" />
      </Link>
    </li>
  );
}

export function Dashboard() {
  const { data, error, loading, reload } = useApi<DashboardResponse>("/api/dashboard/");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Link to="/instructions/new" className={btnPrimary}>
          <Plus aria-hidden className="size-4" />
          New instruction
        </Link>
      </div>

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={reload} />}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={<Inbox className="size-5" />} label="Unresolved replies" value={data.unresolved_replies} tone={data.unresolved_replies ? "amber" : "slate"} />
            <Stat icon={<ListChecks className="size-5" />} label="Recent instructions" value={data.recent_instructions.length} />
            <Stat
              icon={<ShieldAlert className="size-5" />}
              label="With unreviewed wording"
              value={data.recent_instructions.filter((i) => i.has_unreviewed).length}
              tone="amber"
            />
          </div>

          <section aria-labelledby="recent-heading" className="space-y-3">
            <h2 id="recent-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Recent instructions
            </h2>
            {data.recent_instructions.length === 0 ? (
              <EmptyState title="No instructions yet">
                Create one to get a Swahili text, audio and a QR code for the patient.
              </EmptyState>
            ) : (
              <ul className={`${card} divide-y divide-slate-100 overflow-hidden`}>
                {data.recent_instructions.map((i) => (
                  <InstructionRow key={i.id} instruction={i} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
