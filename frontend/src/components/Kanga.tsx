import type { ReactNode } from "react";

/**
 * A kanga-cloth border around content. Used only at signature moments (patient header,
 * QR handover, login) so the pattern keeps its meaning. `unroll` plays the one orchestrated
 * animation: the border draws itself clockwise, then the content rises in.
 */
export function KangaFrame({
  children,
  unroll = false,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  unroll?: boolean;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={`relative rounded-[1.75rem] p-3 ${className}`}>
      <div aria-hidden className={`kanga-tile absolute inset-0 rounded-[1.75rem] ${unroll ? "kanga-unroll" : ""}`} />
      {/* The panel itself is solid from the start, so only the border ring appears to sweep;
          its content rises in once the border has closed. */}
      <div className={`relative rounded-[1.1rem] bg-surface ${innerClassName}`}>
        {unroll ? <div className="after-unroll">{children}</div> : children}
      </div>
    </div>
  );
}

/** A thin band of the same cloth, for edges that should hint at the brand without framing. */
export function KangaBand({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`kanga-tile h-3 ${className}`} />;
}
