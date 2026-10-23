import { ArrowLeft, Ban, CalendarClock, CircleCheck, Copy, ExternalLink, Info, Plus, ShieldAlert, TriangleAlert, VolumeX } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { KangaFrame } from "../../components/Kanga";
import { MiniPlayer } from "../../components/MiniPlayer";
import { ErrorState, LoadingState } from "../../components/StateViews";
import { useToast } from "../../components/Toaster";
import { btnPrimary, btnSecondary, chip, chipTone } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { formatDate, formatDateTime, formatRelative } from "../../lib/format";
import type { InstructionDetail as Detail, InstructionItem, ReviewStatus } from "../../lib/types";
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

function ReviewChip({ status }: { status: ReviewStatus }) {
  if (status === "approved") {
    return (
      <span className={`${chip} ${chipTone.good}`}>
        <CircleCheck aria-hidden className="size-3.5" />
        Reviewed
      </span>
    );
  }
  return (
    <span className={`${chip} ${chipTone.saffron}`}>
      <ShieldAlert aria-hidden className="size-3.5" />
      {status === "missing" ? "Not translated" : "Unreviewed translation"}
    </span>
  );
}

function ItemRow({ item, index }: { item: InstructionItem; index: number }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 py-6">
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">
        {index + 1}
      </span>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-ink">{item.title}</h3>
          <ReviewChip status={item.review_status} />
        </div>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted">English</p>
            <p className="mt-1 leading-relaxed text-ink/90">{item.english_text}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Swahili</p>
            <div className="mt-1 flex items-start gap-3">
              {item.audio_url && <MiniPlayer src={item.audio_url} label={`${item.title} in Swahili`} />}
              <p lang="sw" className="font-display text-[17px] leading-snug text-ink">
                {item.swahili_text}
              </p>
            </div>
          </div>
        </div>
        {!item.audio_url && (
          <p className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink">
            <VolumeX aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            Audio unavailable: the speech service could not be reached when this was created. The patient still sees the
            Swahili text and the digits. Creating the same sentence again later tries the audio again.
          </p>
        )}
        {item.uses_fallback && (
          <p className="flex gap-2 rounded-xl bg-primary-soft p-3 text-sm text-ink">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            The values did not survive translation, so the Swahili uses general wording. The patient sees the exact values
            as digits on their screen.
          </p>
        )}
      </div>
    </li>
  );
}

/** The handover slip: the one object on this screen staff physically turn towards the patient. */
function HandoverSlip({ detail, onChange }: { detail: Detail; onChange: (d: Detail) => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);

  /** A safety withdrawal: deliberate, confirmed, and not undoable from here. */
  async function revoke() {
    setRevoking(true);
    try {
      const updated = await api.post<Detail>(`/api/instructions/${detail.id}/revoke/`);
      onChange(updated);
      setConfirming(false);
      toast({ tone: "success", message: `Link revoked. ${detail.patient_label} can no longer open it.` });
    } catch (err) {
      toast({ tone: "error", message: err instanceof ApiError ? err.message : "Could not revoke the link. Try again." });
    } finally {
      setRevoking(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(detail.patient_url);
      toast({ tone: "success", message: "Link copied" });
    } catch {
      // Clipboard needs a secure context; plain-http LAN access lands here.
      toast({ tone: "error", message: "Could not copy. Select the link and copy it manually." });
    }
  }

  return (
    <KangaFrame innerClassName="space-y-5 p-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Give this to the patient</h2>
        <p className="mt-1 text-sm text-muted">They scan it with their phone camera. No app needed.</p>
      </div>
      {detail.is_expired ? (
        <div className="space-y-3 rounded-xl bg-surface-2 p-4 text-sm text-ink">
          <p className="flex gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            This link no longer works. The patient sees that it has expired.
          </p>
          <Link to="/instructions/new" viewTransition className={`${btnPrimary} w-full`}>
            <Plus aria-hidden className="size-4" />
            Create a corrected instruction
          </Link>
        </div>
      ) : (
        // QR stays dark on white in both themes: phone cameras read that most reliably.
        <img
          src={detail.qr_url}
          alt={`QR code that opens the instructions for ${detail.patient_label}`}
          className="mx-auto aspect-square w-full max-w-64 rounded-2xl bg-white p-3"
        />
      )}
      <div className="space-y-2">
        <label htmlFor="patient-link" className="text-sm text-muted">
          Patient link
        </label>
        <input
          id="patient-link"
          readOnly
          value={detail.patient_url}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full truncate rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink"
        />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={copy} className={btnPrimary}>
            <Copy aria-hidden className="size-4" />
            Copy link
          </button>
          <a href={detail.patient_url} target="_blank" rel="noreferrer" className={btnSecondary}>
            <ExternalLink aria-hidden className="size-4" />
            Open
          </a>
        </div>
      </div>
      {isInsecureForPhones(detail.patient_url) && (
        <p className="flex gap-2 rounded-xl bg-saffron-soft p-3 text-sm text-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          This link uses http, so phones will block voice replies. Set FRONTEND_BASE_URL to the https address.
        </p>
      )}
      <p className="flex items-center gap-2 text-sm text-muted">
        <CalendarClock aria-hidden className="size-4" />
        {detail.is_expired ? "Expired" : "Works until"} {formatDateTime(detail.expires_at)}
      </p>
      {!detail.is_expired && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-danger hover:underline"
        >
          <Ban aria-hidden className="size-4" />
          Revoke link
        </button>
      )}

      <ConfirmDialog
        open={confirming}
        title="Revoke this link?"
        confirmLabel="Revoke link"
        tone="danger"
        Icon={Ban}
        busy={revoking}
        onConfirm={revoke}
        onCancel={() => setConfirming(false)}
      >
        {detail.patient_label} will see "This link has expired" and can no longer read or hear these instructions. This cannot
        be undone. If something was wrong, create a corrected instruction afterwards.
      </ConfirmDialog>
    </KangaFrame>
  );
}

export function InstructionDetail() {
  const { id } = useParams();
  const { data, error, loading, reload, setData } = useApi<Detail>(`/api/instructions/${id ?? ""}/`);

  return (
    <div className="space-y-8">
      <Link
        to="/"
        viewTransition
        className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink"
      >
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
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-16">
          <div className="min-w-0 space-y-6">
            <header className="space-y-3">
              <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">{data.patient_label}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>Created {formatRelative(data.created_at)}</span>
                {data.follow_up_date && <span className={`${chip} ${chipTone.primary}`}>Back {formatDate(data.follow_up_date)}</span>}
                <span className={`${chip} ${chipTone.neutral}`}>
                  {data.items.length} {data.items.length === 1 ? "instruction" : "instructions"}
                </span>
              </div>
            </header>

            {data.has_unreviewed && (
              <div role="note" className="flex gap-2.5 rounded-xl border border-saffron/50 bg-saffron-soft p-3.5 text-sm text-ink">
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  Some Swahili wording has not been checked by a fluent reader yet.{" "}
                  <Link to="/translations" viewTransition className="font-semibold underline underline-offset-2">
                    Review translations
                  </Link>
                </span>
              </div>
            )}

            <ol aria-label="Instructions, in the order the patient sees them" className="divide-y divide-line border-y border-line">
              {data.items.map((item, i) => (
                <ItemRow key={item.id} item={item} index={i} />
              ))}
            </ol>
          </div>

          <aside className="lg:sticky lg:top-8">
            <HandoverSlip detail={data} onChange={(d) => setData(() => d)} />
          </aside>
        </div>
      )}
    </div>
  );
}
