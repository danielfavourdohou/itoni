import { LoaderCircle, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { useBlocker, type BlockerFunction } from "react-router-dom";

import { btnDanger, btnPrimary, btnSecondary } from "./ui";

/**
 * Native modal dialog for "are you sure?" moments. Focus starts on Cancel (the safe choice), Esc cancels,
 * and while `busy` the dialog cannot be dismissed so a request is never orphaned mid-flight.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  Icon,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  Icon?: LucideIcon;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault(); // React state owns open/closed
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-6 text-ink shadow-float backdrop:bg-black/50 open:motion-safe:animate-[toast-in_180ms_ease-out]"
    >
      <h3 id={titleId} className="font-display text-lg font-semibold">
        {title}
      </h3>
      <div className="mt-2 leading-relaxed text-muted">{children}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className={tone === "danger" ? btnDanger : btnPrimary} onClick={onConfirm} disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : Icon && <Icon aria-hidden className="size-4" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Blocking "please wait" modal for slow backend work. It cannot be dismissed, so the form behind it cannot be
 * double-submitted, and it says honestly what is happening rather than faking step-by-step progress.
 */
export function BusyDialog({ open, title, children }: { open: boolean; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy="true"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-8 text-center text-ink shadow-float outline-none backdrop:bg-black/50 open:motion-safe:animate-[toast-in_180ms_ease-out]"
    >
      <LoaderCircle aria-hidden className="mx-auto size-10 animate-spin text-primary dark:text-saffron" />
      <h3 id={titleId} className="mt-5 font-display text-lg font-semibold">
        {title}
      </h3>
      <div role="status" className="mt-2 leading-relaxed text-muted">
        {children}
      </div>
    </dialog>
  );
}

/**
 * Asks before in-app navigation (including ?t= / ?c= changes) or closing the tab would throw away unsaved work.
 * Call `release()` right before a deliberate navigation, such as after a successful save.
 */
export function useLeaveGuard(
  dirty: boolean,
  copy: { title: string; body: string; confirmLabel: string; cancelLabel?: string },
): { dialog: ReactNode; release: () => void } {
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) =>
        dirtyRef.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
      [],
    ),
  );

  // Tab close or reload: the browser shows its own generic prompt.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const release = useCallback(() => {
    dirtyRef.current = false;
  }, []);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      title={copy.title}
      confirmLabel={copy.confirmLabel}
      cancelLabel={copy.cancelLabel ?? "Keep editing"}
      tone="danger"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    >
      {copy.body}
    </ConfirmDialog>
  );
  return { dialog, release };
}
