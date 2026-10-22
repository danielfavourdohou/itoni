/** The name always renders in Fraunces: it carries the ọ́ that Instrument Sans cannot draw. */
export function Brand({ size = "md", tone = "default" }: { size?: "sm" | "md" | "lg"; tone?: "default" | "light" }) {
  const mark = { sm: "size-7 text-base", md: "size-9 text-lg", lg: "size-12 text-2xl" }[size];
  const text = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className={`kanga-tile grid ${mark} shrink-0 place-items-center rounded-xl font-display font-semibold text-white shadow-lift`}
      >
        <span className="grid size-[72%] place-items-center rounded-lg bg-primary text-on-primary dark:bg-primary-strong">Ì</span>
      </span>
      <span className={`font-display ${text} font-semibold tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}>
        Ìtọ́ni
      </span>
    </span>
  );
}
