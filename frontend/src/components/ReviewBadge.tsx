import { CircleCheck, ShieldAlert } from "lucide-react";

import type { ReviewStatus } from "../lib/types";

// Icon + text, never colour alone.
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <CircleCheck aria-hidden className="size-3.5" />
        Reviewed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
      <ShieldAlert aria-hidden className="size-3.5" />
      {status === "missing" ? "Not translated" : "Unreviewed translation"}
    </span>
  );
}
