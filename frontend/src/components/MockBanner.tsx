import { TriangleAlert } from "lucide-react";

// Organizer rule: mocked responses must be disclosed. Not dismissable, never hidden.
export function MockBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div role="status" className="bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white">
      <TriangleAlert aria-hidden className="mr-2 inline size-4 align-[-2px]" />
      MOCK MODE: responses are simulated
    </div>
  );
}
