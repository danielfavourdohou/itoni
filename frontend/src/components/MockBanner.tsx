import { TriangleAlert } from "lucide-react";

// Organizer rule: mocked responses must be disclosed. Not dismissable, never hidden,
// the same strong red in light and dark mode.
export function MockBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div role="status" className="relative z-40 bg-[#C92A2A] px-4 py-2 text-center text-sm font-semibold text-white">
      <TriangleAlert aria-hidden className="mr-2 inline size-4 align-[-3px]" />
      MOCK MODE: responses are simulated
    </div>
  );
}
