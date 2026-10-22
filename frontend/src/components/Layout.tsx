import { LayoutDashboard, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { MockBanner } from "./MockBanner";
import { btnGhost } from "./ui";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export function Layout() {
  const { user, mockMode, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold text-teal-800">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-teal-700 text-white">
              Ì
            </span>
            Ìtọ́ni
          </NavLink>
          {/* Phones: logo and logout share the top row, nav wraps below. Laptop: one row. */}
          <nav aria-label="Main" className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto">
            <NavLink to="/" end className={navLink}>
              <LayoutDashboard aria-hidden className="size-4" />
              Dashboard
            </NavLink>
            <NavLink to="/instructions/new" className={navLink}>
              <Plus aria-hidden className="size-4" />
              New instruction
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
