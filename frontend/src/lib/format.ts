// Dates as DD/MM/YYYY, the format used in Kenya and Tanzania (matches the backend's rendering).

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "YYYY-MM-DD" is a calendar date, not an instant: format it without timezone shifts. */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : isoDate;
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function formatInstantAsDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** Today in the browser's timezone as YYYY-MM-DD, for <input type="date" min>. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
