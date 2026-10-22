import { Link } from "react-router-dom";

import { btnSecondary } from "../components/ui";

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-semibold text-teal-700">404</p>
      <p className="text-slate-600">This page does not exist.</p>
      <Link to="/" className={btnSecondary}>
        Go to the dashboard
      </Link>
    </div>
  );
}
