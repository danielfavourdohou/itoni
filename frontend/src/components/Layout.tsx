import { ChartColumn, Inbox, Languages, LayoutDashboard, LogOut, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { REPLIES_CHANGED } from "../lib/events";
import type { DashboardResponse } from "../lib/types";
import { useApi } from "../lib/useApi";
import { MockBanner } from "./MockBanner";
import { btnGhost } from "./ui";

const BADGE_POLL_MS = 30_000;

const navLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition sm:gap-2 sm:px-3 ${
    isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

/** Unresolved reply count for the nav badge: polled, and refreshed at once when a reply changes. */
function useUnresolvedCount(): number {
  const { data, reload } = useApi<DashboardResponse>("/api/dashboard/", { pollMs: BADGE_POLL_MS });
  useEffect(() => {
    window.addEventListener(REPLIES_CHANGED, reload);
    return () => window.removeEventListener(REPLIES_CHANGED, reload);
  }, [reload]);
  return data?.unresolved_replies ?? 0;
}

export function Layout() {
  const { user, mockMode, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const unresolved = useUnresolvedCount();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      // Network failure: the session is still valid server-side, so stay put; the button re-enables.
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <MockBanner show={mockMode} />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold text-teal-800">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-teal-700 text-white">
              Ì
            </span>
            Ìtọ́ni
          </NavLink>
          {/* Below lg: logo and logout share the top row; the nav gets its own row and wraps,
              so every link stays visible (no hidden sideways scroll). lg and up: one row. */}
          <nav
            aria-label="Main"
            className="order-last flex w-full flex-wrap items-center gap-1 whitespace-nowrap lg:order-none lg:w-auto"
          >
            <NavLink to="/" end className={navLink}>
              <LayoutDashboard aria-hidden className="size-4" />
              Dashboard
            </NavLink>
            <NavLink to="/instructions/new" className={navLink}>
              <Plus aria-hidden className="size-4" />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New instruction</span>
            </NavLink>
            <NavLink to="/inbox" className={navLink}>
              <Inbox aria-hidden className="size-4" />
              Inbox
              {unresolved > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white tabular-nums">
                  {unresolved}
                  <span className="sr-only"> unresolved</span>
                </span>
              )}
            </NavLink>
            <NavLink to="/translations" className={navLink}>
              <Languages aria-hidden className="size-4" />
              Translations
            </NavLink>
            <NavLink to="/usage" className={navLink}>
              <ChartColumn aria-hidden className="size-4" />
              Usage
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.username}</span>
            <button type="button" className={btnGhost} onClick={handleLogout} disabled={loggingOut}>
              <LogOut aria-hidden className="size-4" />
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
