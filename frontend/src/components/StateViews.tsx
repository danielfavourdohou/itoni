import { CircleAlert, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { btnSecondary, card } from "./ui";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
      <CircleAlert aria-hidden className="size-8 text-red-600" />
      <p className="text-slate-700">{message}</p>
      {onRetry && (
        <button type="button" className={btnSecondary} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center gap-2 border-dashed px-6 py-12 text-center`}>
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}
