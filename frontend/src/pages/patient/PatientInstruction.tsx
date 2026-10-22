import { CircleAlert, LoaderCircle, Phone, RotateCw, TriangleAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { AudioPlayer } from "../../components/AudioPlayer";
import { Brand } from "../../components/Brand";
import { DigitsBox } from "../../components/DigitsBox";
import { KangaFrame } from "../../components/Kanga";
import { MockBanner } from "../../components/MockBanner";
import { Recorder } from "../../components/Recorder";
import type { Labels, PatientInstruction as Data, PatientItem, PatientNotFoundBody } from "../../lib/types";
import { useApi } from "../../lib/useApi";

// Every patient-facing string comes from `labels` (translated). No English is hardcoded here.

function Player({ item, labels }: { item: PatientItem; labels: Labels }) {
  if (!item.audio_url) return null;
  return (
    <AudioPlayer
      src={item.audio_url}
      playLabel={labels.label_play ?? ""}
      pauseLabel={labels.label_pause ?? ""}
      tone={item.is_warning ? "warning" : "default"}
    />
  );
}

function Shell({ mock, children }: { mock: boolean; children: ReactNode }) {
  return (
    // UI text uses the phone's own font so Instrument Sans is never downloaded here (size budget);
    // sentences, brand and digits keep Fraunces via font-display.
    <div className="min-h-dvh bg-canvas font-[system-ui,-apple-system,'Segoe_UI',Roboto,sans-serif] text-[17px]">
      <MockBanner show={mock} />
      <main className="mx-auto max-w-xl space-y-8 px-4 pt-5 pb-14 sm:px-6 sm:pt-10 lg:max-w-6xl lg:px-10 lg:pt-12">
        {children}
      </main>
    </div>
  );
}

export function PatientInstruction() {
  const { token = "" } = useParams();
  const { data, error, loading, reload } = useApi<Data>(`/api/p/${encodeURIComponent(token)}/`);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = "sw";
    return () => {
      root.lang = previous;
    };
  }, []);

  if (loading && !data) {
    return (
      <Shell mock={false}>
        <div role="status" aria-busy="true" className="flex justify-center py-28 text-primary">
          <LoaderCircle aria-hidden className="size-10 animate-spin" />
        </div>
      </Shell>
    );
  }

  if (error) {
    const body = error.body as Partial<PatientNotFoundBody> | null;
    const labels = body?.labels;
    if (error.status === 404 && labels) {
      return (
        <Shell mock={Boolean(body?.mock_mode)}>
          <Brand size="md" />
          <div role="alert" className="flex flex-col items-center gap-5 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-muted">
              <CircleAlert aria-hidden className="size-8" />
            </span>
            <p className="max-w-sm font-display text-xl leading-snug text-ink">{labels.label_link_expired}</p>
          </div>
        </Shell>
      );
    }
    // Server unreachable: no translated labels exist yet, so use icons, not English.
    return (
      <Shell mock={false}>
        <Brand size="md" />
        <div role="alert" className="flex flex-col items-center gap-6 py-16">
          <CircleAlert aria-hidden className="size-12 text-danger" />
          <button
            type="button"
            onClick={reload}
            aria-label="↻"
            className="grid size-16 place-items-center rounded-full bg-primary text-on-primary shadow-lift active:scale-95"
          >
            <RotateCw aria-hidden className="size-8" />
          </button>
        </div>
      </Shell>
    );
  }

  if (!data) return null;
  const { labels } = data;
  const regular = data.items.filter((i) => !i.is_warning);
  const warnings = data.items.filter((i) => i.is_warning);
  const [first, ...rest] = regular;

  // Order per spec: header, instructions, digits label, danger signs, reply, safety footer.
  // Desktop: two columns, the kanga instruction and the digits label sticky on the left. The digits
  // render in one place per breakpoint (display:none hides the other), so reading order stays right.
  return (
    <Shell mock={data.mock_mode}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
        <div className="space-y-8 lg:sticky lg:top-10">
          {/* The signature moment: the kanga border unrolls around the first instruction, its "saying". */}
          <KangaFrame unroll innerClassName="space-y-6 p-6 sm:p-8">
            <header className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Brand size="sm" />
                <span lang="en" className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-muted">
                  {data.patient_label}
                </span>
              </div>
              <h1 className="text-base font-medium text-muted">{labels.label_heading}</h1>
            </header>
            {first && (
              <div className="space-y-6">
                <p className="font-display text-2xl leading-[1.3] font-medium text-balance text-ink">
                  {first.text}
                </p>
                <Player item={first} labels={labels} />
              </div>
            )}
          </KangaFrame>
          <div className="hidden lg:block">
            <DigitsBox digits={data.digits} labels={labels} />
          </div>
        </div>

        <div className="mt-8 space-y-8 lg:mt-0">
          {rest.length > 0 && (
            // On desktop the list sits at the top of its column, so it drops the top rule.
            <ol className="divide-y divide-line border-y border-line lg:border-t-0 lg:[&>li:first-child]:pt-0">
              {rest.map((item) => (
                <li key={item.id} className="space-y-5 py-7">
                  <p className="font-display text-[1.3rem] leading-snug text-ink">{item.text}</p>
                  <Player item={item} labels={labels} />
                </li>
              ))}
            </ol>
          )}

          <div className="lg:hidden">
            <DigitsBox digits={data.digits} labels={labels} />
          </div>

          {warnings.map((item) => (
            <section key={item.id} className="space-y-5 rounded-3xl border-2 border-danger/40 bg-danger-soft p-6">
              <p className="flex gap-3 font-display text-[1.3rem] leading-snug font-semibold text-danger-ink">
                <TriangleAlert aria-hidden className="mt-1 size-7 shrink-0 text-danger" />
                <span>{item.text}</span>
              </p>
              <Player item={item} labels={labels} />
            </section>
          ))}

          <Recorder token={token} labels={labels} />

          <footer className="flex gap-3.5 rounded-2xl bg-surface-2/70 p-5 text-base leading-relaxed text-ink">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-primary">
              <Phone aria-hidden className="size-5" />
            </span>
            <p>{labels.label_safety_footer}</p>
          </footer>
        </div>
      </div>
    </Shell>
  );
}
