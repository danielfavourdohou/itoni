import { ArrowLeft, CalendarClock, ExternalLink, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { CopyButton } from "../../components/CopyButton";
import { ReviewBadge } from "../../components/ReviewBadge";
import { ErrorState, LoadingState } from "../../components/StateViews";
import { btnSecondary, card } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/format";
import type { InstructionDetail as Detail, InstructionItem } from "../../lib/types";
import { useApi } from "../../lib/useApi";

/** Phones block the microphone on plain http, except localhost. */
function isInsecureForPhones(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" && !["localhost", "127.0.0.1"].includes(u.hostname);
  } catch {
    return false;
  }
}

function ItemCard({ item, index }: { item: InstructionItem; index: number }) {
  return (
    <li className={`${card} p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {index + 1}
        </span>
        <h3 className="font-semibold text-slate-900">{item.title}</h3>
        <ReviewBadge status={item.review_status} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">English</p>
          <p className="mt-1 text-slate-700">{item.english_text}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Swahili</p>
          <p lang="sw" className="mt-1 text-slate-900">
            {item.swahili_text}
          </p>
        </div>
      </div>

      {item.uses_fallback && (
        <p className="mt-4 flex gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          The values did not survive translation, so the Swahili uses general wording. The patient sees the exact
          values as digits in the box on their page.
        </p>
      )}

      {item.audio_url ? (
        <audio controls preload="none" src={item.audio_url} className="mt-4 w-full">
          Your browser cannot play this audio.
        </audio>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No audio for this item.</p>
      )}
    </li>
  );
}

function HandoverCard({ detail }: { detail: Detail }) {
  return (
    <section aria-labelledby="handover-heading" className={`${card} space-y-4 p-5`}>
      <h2 id="handover-heading" className="font-semibold text-slate-900">
        Give to the patient
      </h2>
      {detail.is_expired ? (
        <p className="flex gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          This link has expired. Create a new instruction for the patient.
        </p>
      ) : (
        <>
          <img
            src={detail.qr_url}
            alt={`QR code that opens the instructions for ${detail.patient_label}`}
            className="mx-auto aspect-square w-full max-w-60 rounded-lg border border-slate-100 bg-white p-2"
          />
          <p className="text-center text-sm text-slate-500">Ask the patient to scan this with their phone camera.</p>
        </>
      )}

      <div>
        <label htmlFor="patient-link" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Patient link
        </label>
        <input
          id="patient-link"
          readOnly
          value={detail.patient_url}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 block w-full truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton text={detail.patient_url} />
          <a href={detail.patient_url} target="_blank" rel="noreferrer" className={btnSecondary}>
            <ExternalLink aria-hidden className="size-4" />
            Open
          </a>
        </div>
      </div>

      {isInsecureForPhones(detail.patient_url) && (
        <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          This link uses http, so phones will block voice replies. Set FRONTEND_BASE_URL to the https address.
        </p>
      )}

      <p className="flex items-center gap-2 text-sm text-slate-500">
        <CalendarClock aria-hidden className="size-4" />
        Link {detail.is_expired ? "expired" : "works until"} {formatDateTime(detail.expires_at)}
      </p>
    </section>
  );
}

export function InstructionDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<Detail>(`/api/instructions/${id ?? ""}/`);

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="size-4" />
        Dashboard
      </Link>

      {loading && !data && <LoadingState />}
      {error &&
        (error.status === 404 ? (
          <ErrorState message="This instruction does not exist." />
        ) : (
          <ErrorState message={error.message} onRetry={reload} />
        ))}

      {data && (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{data.patient_label}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Created {formatDateTime(data.created_at)}
              {data.follow_up_date && <> · Come back on {formatDate(data.follow_up_date)}</>}
            </p>
          </div>

          {data.has_unreviewed && (
            <div role="note" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              Some Swahili wording has not been checked by a fluent reader yet. Review it before relying on it.
            </div>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <ol className="space-y-4" aria-label="Instructions">
              {data.items.map((item, i) => (
                <ItemCard key={item.id} item={item} index={i} />
              ))}
            </ol>
            <div className="lg:sticky lg:top-6">
              <HandoverCard detail={data} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
