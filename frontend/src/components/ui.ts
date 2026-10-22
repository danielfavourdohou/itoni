// Shared class strings so buttons, inputs and cards look the same on every screen.

export const card = "rounded-xl border border-slate-200 bg-white";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${btnBase} bg-teal-700 text-white hover:bg-teal-800`;
export const btnSecondary = `${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const btnGhost = `${btnBase} text-slate-600 hover:bg-slate-100`;

export const label = "block text-sm font-medium text-slate-700";
export const input =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 " +
  "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20";
export const fieldError = "mt-1 text-sm text-red-700";
