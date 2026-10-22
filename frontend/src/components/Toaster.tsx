import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const TOAST_MS = 5000;

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<Toast, "id">;

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(TOAST_MS);
  const startedAt = useRef(Date.now());

  // Hovering or focusing a toast pauses its timer, so Undo is never snatched away mid-reach.
  useEffect(() => {
    if (paused) {
      remaining.current -= Date.now() - startedAt.current;
      return;
    }
    startedAt.current = Date.now();
    const timer = window.setTimeout(onClose, remaining.current);
    return () => window.clearTimeout(timer);
  }, [paused, onClose]);

  const error = toast.tone === "error";
  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-ink py-3 pr-2 pl-4 text-sm text-canvas shadow-float motion-safe:animate-[toast-in_220ms_ease-out]"
    >
      {error ? (
        <CircleAlert aria-hidden className="size-5 shrink-0 text-danger" />
      ) : (
        <CircleCheck aria-hidden className="size-5 shrink-0 text-saffron" />
      )}
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
          className="min-h-9 rounded-lg px-3 font-semibold text-saffron hover:bg-white/10"
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Dismiss" className="grid size-9 place-items-center rounded-lg hover:bg-white/10">
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]); // at most 3 on screen
  }, []);
  const remove = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Above the phone tab bar; bottom-centre on desktop. */}
      <ol
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </ol>
    </ToastContext.Provider>
  );
}

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
