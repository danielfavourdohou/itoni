import { CircleAlert, Download, FlaskConical, Info, LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useToast } from "../../components/Toaster";
import { btnSecondary } from "../../components/ui";
import type { UsageKind, UsageSummary } from "../../lib/types";
import { useApi } from "../../lib/useApi";

const POLL_MS = 30_000;
// Every patient reply is a new recording, so speech kinds have no cache to hit.
const UNCACHED_KINDS = new Set(["st", "stt"]);
const number = new Intl.NumberFormat("en-GB");

function percent(rate: number | null): string {
  return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}

function latency(ms: number | null): string {
  return ms === null ? "n/a" : `${number.format(ms)} ms`;
}

/** Single ratio against 100%: indigo fill on a lighter track of the same ramp, value always as text. */
function HitRateMeter({ rate, cacheable = true }: { rate: number | null; cacheable?: boolean }) {
  if (!cacheable) return <span className="text-muted">Not cached</span>;
  return (
    <span className="inline-flex items-center gap-3">
      <span aria-hidden className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-primary-soft">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
      </span>
      <span className="text-ink tabular-nums">{percent(rate)}</span>
    </span>
  );
}

function Errors({ count }: { count: number }) {
  if (count === 0) return <span className="tabular-nums">0</span>;
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-danger tabular-nums">
      <CircleAlert aria-hidden className="size-4" />
      {number.format(count)}
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-ink">{value}</dd>
      <dd className="text-xs text-muted">{note}</dd>
    </div>
  );
}

/** Phones: one divided block per API instead of a wide table. */
function KindRows({ k }: { k: UsageKind }) {
  const rows: [string, ReactNode][] = [
    ["Live calls", <span className="tabular-nums">{number.format(k.live)}</span>],
    ["Cache hits", <span className="tabular-nums">{number.format(k.cached)}</span>],
    ["Mocked", <span className="tabular-nums">{number.format(k.mocked)}</span>],
    ["Errors", <Errors count={k.errors} />],
    ["Cache hit rate", <HitRateMeter rate={k.cache_hit_rate} cacheable={!UNCACHED_KINDS.has(k.kind)} />],
    ["Average live latency", <span className="tabular-nums">{latency(k.avg_latency_ms)}</span>],
  ];
  return (
    <li className="py-4">
      <h3 className="font-semibold text-ink">{k.label}</h3>
      <dl className="mt-2 divide-y divide-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

export function Usage() {
  const { data, error, loading, reload } = useApi<UsageSummary>("/api/usage/", { pollMs: POLL_MS });
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  /** Fetched rather than a plain link, so a large log shows progress and a failure shows a message, not a broken file. */
  async function downloadCsv() {
    setDownloading(true);
    try {
      const res = await fetch("/api/usage.csv", { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "itoni-usage.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); // Firefox needs the URL alive past the click
    } catch {
      toast({ tone: "error", message: "Could not download the CSV. Check your connection and try again." });
    } finally {
      setDownloading(false);
    }
  }
  const totals = data?.totals;
  const served = totals ? totals.cached + totals.live + totals.mocked : 0;
  const overallHitRate = totals && served ? totals.cached / served : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">API usage</h1>
          <p className="mt-1 text-muted">Tokens spent, and tokens saved by the cache.</p>
        </div>
        <button type="button" onClick={downloadCsv} disabled={downloading} aria-busy={downloading} className={btnSecondary}>
          {downloading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
          {downloading ? "Preparing CSV" : "Download CSV"}
        </button>
      </header>

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={reload} />}

      {data && totals && (
        <>
          {totals.live === 0 && totals.mocked > 0 && (
            <p className="flex gap-2.5 rounded-xl border border-line bg-surface p-3.5 text-sm text-ink">
              <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              Only mock calls so far: no tokens have been spent. Live numbers appear after the first real API call.
            </p>
          )}

          <section aria-label="Totals" className="grid items-stretch gap-6 border-y border-line py-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-0 lg:divide-x lg:divide-line">
            <div className="lg:pr-8">
              <p className="text-sm text-muted">Live API calls</p>
              <p className="font-display text-6xl leading-none font-semibold text-primary">{number.format(totals.live)}</p>
              <p className="mt-2 text-sm text-muted">Requests that reached NKENNEAi and used tokens</p>
            </div>
            <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x lg:pl-4 [&>div:nth-child(n+3)]:border-t [&>div:nth-child(n+3)]:border-line sm:[&>div:nth-child(n+3)]:border-t-0">
              <Stat label="Cache hits" value={number.format(totals.cached)} note="No API call made" />
              <Stat label="Cache hit rate" value={percent(overallHitRate)} note="Of all requests" />
              <Stat label="Mocked calls" value={number.format(totals.mocked)} note="Development only" />
              <Stat label="Errors" value={number.format(totals.errors)} note="Failed or rejected" />
            </dl>
          </section>

          {data.by_kind.length === 0 ? (
            <EmptyState title="No API calls logged yet" />
          ) : (
            <section aria-labelledby="by-kind" className="space-y-3">
              <h2 id="by-kind" className="font-display text-lg font-semibold text-ink">
                By API
              </h2>
              <ul className="divide-y divide-line border-y border-line lg:hidden">
                {data.by_kind.map((k) => (
                  <KindRows key={k.kind} k={k} />
                ))}
              </ul>
              <div className="hidden overflow-x-auto border-y border-line lg:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">API calls by kind</caption>
                  <thead className="text-left text-muted">
                    <tr className="border-b border-line">
                      <th scope="col" className="py-3 pr-4 font-medium">API</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Live calls</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Cache hits</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Mocked</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Errors</th>
                      <th scope="col" className="px-4 py-3 font-medium">Cache hit rate</th>
                      <th scope="col" className="py-3 pl-4 text-right font-medium">Avg live latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {data.by_kind.map((k) => (
                      <tr key={k.kind} className="transition hover:bg-surface">
                        <th scope="row" className="py-3.5 pr-4 text-left font-semibold">{k.label}</th>
                        <td className="px-4 py-3.5 text-right tabular-nums">{number.format(k.live)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{number.format(k.cached)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{number.format(k.mocked)}</td>
                        <td className="px-4 py-3.5 text-right"><Errors count={k.errors} /></td>
                        <td className="px-4 py-3.5"><HitRateMeter rate={k.cache_hit_rate} cacheable={!UNCACHED_KINDS.has(k.kind)} /></td>
                        <td className="py-3.5 pl-4 text-right tabular-nums">{latency(k.avg_latency_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="flex gap-2 text-xs text-muted">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Speech Translation and Speech-to-Text are never cached: every patient reply is a new recording.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
