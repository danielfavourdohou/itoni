import { CircleAlert, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { btnSecondary } from "./ui";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2.5 py-20 text-muted">
      <LoaderCircle aria-hidden className="size-5 animate-spin text-primary" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-danger/30 bg-danger-soft px-6 py-12 text-center">
      <CircleAlert aria-hidden className="size-9 text-danger" />
      <p className="max-w-md text-ink">{message}</p>
      {onRetry && (
        <button type="button" className={btnSecondary} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Empty screens invite the next action rather than just saying "nothing here". */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}
