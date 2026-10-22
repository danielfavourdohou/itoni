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

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "Just now", "12 min ago", "Today 14:05", "Yesterday 22:09", else DD/MM/YYYY. */
export function formatRelative(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (then.getTime() >= startOfToday) return `Today ${timeFmt.format(then)}`;
  if (then.getTime() >= startOfToday - 86_400_000) return `Yesterday ${timeFmt.format(then)}`;
  return dateFmt.format(then);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
