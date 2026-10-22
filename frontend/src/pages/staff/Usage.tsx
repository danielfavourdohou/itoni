import { CircleAlert, Download, FlaskConical, Info } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { btnSecondary, card } from "../../components/ui";
import type { UsageKind, UsageSummary } from "../../lib/types";
import { useApi } from "../../lib/useApi";

const POLL_MS = 30_000;
// Every patient reply is a new recording, so Speech Translation has no cache to hit.
const UNCACHED_KIND = "st";
const number = new Intl.NumberFormat("en-GB");

function percent(rate: number | null): string {
  return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}

/** Single ratio against 100%: teal fill on a lighter teal track (same ramp), value always as text. */
function HitRateMeter({ rate, cacheable = true }: { rate: number | null; cacheable?: boolean }) {
  if (!cacheable) return <span className="text-slate-500">Not cached</span>;
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-teal-100">
        <div className="h-full rounded-full bg-teal-700" style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
      </div>
      <span className="tabular-nums text-slate-900">{percent(rate)}</span>
    </div>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function Errors({ count }: { count: number }) {
  if (count === 0) return <span className="tabular-nums text-slate-900">0</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums font-medium text-red-700">
      <CircleAlert aria-hidden className="size-4" />
      {number.format(count)}
    </span>
  );
}

function latency(ms: number | null): string {
  return ms === null ? "n/a" : `${number.format(ms)} ms`;
}

/** Phones and tablets: one card per API instead of a wide table. */
function KindCard({ k }: { k: UsageKind }) {
  const rows: [string, ReactNode][] = [
    ["Live calls", <span className="tabular-nums">{number.format(k.live)}</span>],
    ["Cache hits", <span className="tabular-nums">{number.format(k.cached)}</span>],
    ["Mocked", <span className="tabular-nums">{number.format(k.mocked)}</span>],
    ["Errors", <Errors count={k.errors} />],
    ["Cache hit rate", <HitRateMeter rate={k.cache_hit_rate} cacheable={k.kind !== UNCACHED_KIND} />],
    ["Average live latency", <span className="tabular-nums">{latency(k.avg_latency_ms)}</span>],
  ];
  return (
    <li className={`${card} p-4`}>
      <h3 className="font-semibold text-slate-900">{k.label}</h3>
      <dl className="mt-3 divide-y divide-slate-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

export function Usage() {
  const { data, error, loading, reload } = useApi<UsageSummary>("/api/usage/", { pollMs: POLL_MS });
  const totals = data?.totals;
  const served = totals ? totals.cached + totals.live + totals.mocked : 0;
  const overallHitRate = totals && served ? totals.cached / served : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">API usage</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Every NKENNEAi request is logged. Cache hits are answered from the database and cost no tokens.
          </p>
        </div>
        <a href="/api/usage.csv" download className={btnSecondary}>
          <Download aria-hidden className="size-4" />
          Download CSV
        </a>
      </div>

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={reload} />}

      {data && totals && (
        <>
          {totals.live === 0 && totals.mocked > 0 && (
            <p className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-slate-500" />
              Only mock calls so far: no tokens have been spent. Live numbers appear after the first real API call.
            </p>
          )}

          <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className={`${card} col-span-2 p-5 lg:col-span-1`}>
              <p className="text-sm text-slate-500">Live API calls</p>
              <p className="mt-1 text-5xl font-semibold text-teal-800">{number.format(totals.live)}</p>
              <p className="mt-1 text-xs text-slate-500">Requests that reached NKENNEAi and used tokens</p>
            </div>
            <StatTile label="Cache hits" value={number.format(totals.cached)} note="Answered without an API call" />
            <StatTile label="Cache hit rate" value={percent(overallHitRate)} note="Of all requests" />
            <StatTile label="Mocked calls" value={number.format(totals.mocked)} note="Development only, no tokens" />
            <StatTile label="Errors" value={number.format(totals.errors)} note="Failed or rejected calls" />
          </section>

          {data.by_kind.length === 0 ? (
            <EmptyState title="No API calls logged yet" />
          ) : (
            <section aria-labelledby="by-kind" className="space-y-3">
              <h2 id="by-kind" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                By API
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
                {data.by_kind.map((k) => (
                  <KindCard key={k.kind} k={k} />
                ))}
              </ul>
              <div className={`${card} hidden overflow-x-auto lg:block`}>
                <table className="w-full text-sm">
                  <caption className="sr-only">API calls by kind</caption>
                  <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">API</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Live calls</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Cache hits</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Mocked</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Errors</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Cache hit rate</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Avg live latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.by_kind.map((k) => (
                      <tr key={k.kind}>
                        <th scope="row" className="px-4 py-3 text-left font-medium text-slate-900">{k.label}</th>
                        <td className="px-4 py-3 text-right tabular-nums">{number.format(k.live)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{number.format(k.cached)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{number.format(k.mocked)}</td>
                        <td className="px-4 py-3 text-right"><Errors count={k.errors} /></td>
                        <td className="px-4 py-3"><HitRateMeter rate={k.cache_hit_rate} cacheable={k.kind !== UNCACHED_KIND} /></td>
                        <td className="px-4 py-3 text-right tabular-nums">{latency(k.avg_latency_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="flex gap-2 text-xs text-slate-500">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Speech Translation is never cached: every patient reply is a new recording.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
