import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { btnSecondary } from "./ui";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      // Clipboard API needs a secure context; plain-http LAN access falls through to "failed".
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button type="button" className={btnSecondary} onClick={copy}>
      {state === "copied" ? <Check aria-hidden className="size-4 text-emerald-700" /> : <Copy aria-hidden className="size-4" />}
      <span aria-live="polite">
        {state === "copied" ? "Copied" : state === "failed" ? "Select and copy manually" : label}
      </span>
    </button>
  );
}
