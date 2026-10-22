import { CircleAlert, LoaderCircle, Phone, RotateCw, TriangleAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { AudioPlayer } from "../../components/AudioPlayer";
import { DigitsBox } from "../../components/DigitsBox";
import { MockBanner } from "../../components/MockBanner";
import type { Labels, PatientInstruction as Data, PatientItem, PatientNotFoundBody } from "../../lib/types";
import { useApi } from "../../lib/useApi";

// Every patient-facing string comes from `labels` (translated). No English is hardcoded here.

function Brand() {
  return (
    <p className="flex items-center gap-2 font-semibold text-teal-800">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-teal-700 text-sm text-white">
        Ì
      </span>
      Ìtọ́ni
    </p>
  );
}

function InstructionCard({ item, labels }: { item: PatientItem; labels: Labels }) {
  const warning = item.is_warning;
  return (
    <li
      className={`space-y-5 rounded-2xl border p-5 ${
        warning ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className={`flex gap-3 text-[22px] leading-snug ${warning ? "font-semibold text-red-900" : "text-slate-900"}`}>
        {warning && <TriangleAlert aria-hidden className="mt-1 size-7 shrink-0 text-red-700" />}
        <span>{item.text}</span>
      </p>
      {item.audio_url && (
        <AudioPlayer
          src={item.audio_url}
          playLabel={labels.label_play ?? ""}
          pauseLabel={labels.label_pause ?? ""}
          tone={warning ? "warning" : "default"}
        />
      )}
    </li>
  );
}

function Shell({ mock, children }: { mock: boolean; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas text-lg">
      <MockBanner show={mock} />
      <main className="mx-auto max-w-md space-y-5 px-4 py-6">{children}</main>
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
        <div role="status" aria-busy="true" className="flex justify-center py-24 text-teal-700">
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
          <Brand />
          <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <CircleAlert aria-hidden className="size-12 text-slate-400" />
            <p className="text-[22px] leading-snug text-slate-900">{labels.label_link_expired}</p>
          </div>
        </Shell>
      );
    }
    // Server unreachable: no translated labels exist yet, so use icons, not English.
    return (
      <Shell mock={false}>
        <Brand />
        <div role="alert" className="flex flex-col items-center gap-6 py-16">
          <CircleAlert aria-hidden className="size-12 text-red-600" />
          <button
            type="button"
            onClick={reload}
            aria-label="↻"
            className="grid size-16 place-items-center rounded-full bg-teal-700 text-white active:scale-95"
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

  // Order per spec: header, instruction cards, digits box, danger signs, (reply), safety footer.
  return (
    <Shell mock={data.mock_mode}>
      <header className="space-y-2">
        <Brand />
        <h1 className="text-2xl font-bold leading-tight text-slate-900">{labels.label_heading}</h1>
        <p lang="en" className="inline-block rounded-full bg-slate-100 px-3 py-1 text-base font-medium text-slate-700">
          {data.patient_label}
        </p>
      </header>

      {regular.length > 0 && (
        <ol className="space-y-4">
          {regular.map((item) => (
            <InstructionCard key={item.id} item={item} labels={labels} />
          ))}
        </ol>
      )}

      <DigitsBox digits={data.digits} labels={labels} />

      {warnings.length > 0 && (
        <ul className="space-y-4">
          {warnings.map((item) => (
            <InstructionCard key={item.id} item={item} labels={labels} />
          ))}
        </ul>
      )}

      <footer className="flex gap-3 rounded-2xl bg-slate-100 p-5 text-base text-slate-700">
        <Phone aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>{labels.label_safety_footer}</p>
      </footer>
    </Shell>
  );
}
