import { ChartColumn, Inbox, Languages, LayoutDashboard, LogOut, Plus, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { REPLIES_CHANGED } from "../lib/events";
import type { DashboardResponse } from "../lib/types";
import { useApi } from "../lib/useApi";
import { Brand } from "./Brand";
import { MockBanner } from "./MockBanner";
import { ThemeCycleButton, ThemeToggle } from "./ThemeToggle";

const BADGE_POLL_MS = 30_000;

interface NavItem {
  to: string;
  label: string;
  short: string; // phone tab bar
  Icon: LucideIcon;
  end?: boolean;
  badge?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", short: "Home", Icon: LayoutDashboard, end: true },
  { to: "/instructions/new", label: "New instruction", short: "New", Icon: Plus },
  { to: "/inbox", label: "Inbox", short: "Inbox", Icon: Inbox, badge: true },
  { to: "/translations", label: "Translations", short: "Review", Icon: Languages },
  { to: "/usage", label: "Usage", short: "Usage", Icon: ChartColumn },
];

/** Unresolved reply count for the nav badge: polled, and refreshed at once when a reply changes. */
function useUnresolvedCount(): number {
  const { data, reload } = useApi<DashboardResponse>("/api/dashboard/", { pollMs: BADGE_POLL_MS });
  useEffect(() => {
    window.addEventListener(REPLIES_CHANGED, reload);
    return () => window.removeEventListener(REPLIES_CHANGED, reload);
  }, [reload]);
  return data?.unresolved_replies ?? 0;
}

function Badge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`grid min-w-5 place-items-center rounded-full bg-saffron px-1.5 text-[11px] font-bold leading-5 text-on-saffron tabular-nums ${className}`}>
      {count}
      <span className="sr-only"> unresolved</span>
    </span>
  );
}

/** Desktop: icon + label. Tablet: icon only (label for screen readers and as a tooltip). */
function SideLink({ item, unresolved }: { item: NavItem; unresolved: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      viewTransition
      title={item.label}
      className={({ isActive }) =>
        `group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition md:justify-center lg:justify-start ${
          isActive ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              style={{ viewTransitionName: "nav-indicator" }}
              className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-saffron"
            />
          )}
          <span className="relative">
            <item.Icon aria-hidden className="size-5" />
            {item.badge && unresolved > 0 && (
              <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-saffron ring-2 ring-surface lg:hidden" />
            )}
          </span>
          <span className="sr-only lg:not-sr-only">{item.label}</span>
          {item.badge && <Badge count={unresolved} className="ml-auto hidden lg:grid" />}
        </>
      )}
    </NavLink>
  );
}

function TabLink({ item, unresolved }: { item: NavItem; unresolved: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      viewTransition
      className={({ isActive }) =>
        `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition active:scale-95 ${
          isActive ? "text-primary" : "text-muted"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative grid h-8 w-12 place-items-center rounded-full transition ${isActive ? "bg-primary-soft" : ""}`}>
            <item.Icon aria-hidden className="size-5" />
            {item.badge && <Badge count={unresolved} className="absolute -top-1 -right-1" />}
          </span>
          {item.short}
        </>
      )}
    </NavLink>
  );
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
    <div className="flex min-h-dvh flex-col">
      <MockBanner show={mockMode} />
      <div className="flex flex-1">
        {/* Tablet: icon rail. Desktop: full sidebar. Phones use the bottom tab bar instead. */}
        {/* With the MOCK banner above it, the sidebar must be shorter by the banner's height or its footer is cut off. */}
        <aside
          className={`sticky top-0 hidden w-20 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-5 md:flex lg:w-64 lg:px-4 ${
            mockMode ? "h-[calc(100dvh-2.25rem)]" : "h-dvh"
          }`}
        >
          <NavLink to="/" viewTransition className="flex justify-center rounded-xl lg:justify-start lg:px-2" aria-label="Ìtọ́ni dashboard">
            <span className="lg:hidden">
              <BrandMark />
            </span>
            <span className="hidden lg:inline">
              <Brand size="md" />
            </span>
          </NavLink>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {NAV.map((item) => (
              <SideLink key={item.to} item={item} unresolved={unresolved} />
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
            <div className="flex justify-center lg:hidden">
              <ThemeCycleButton />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line p-1.5 lg:pl-3">
              <span className="hidden min-w-0 flex-1 truncate text-sm font-medium text-ink lg:block">{user?.username}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                title="Log out"
                className="mx-auto grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink lg:mx-0"
              >
                <LogOut aria-hidden className="size-4" />
                <span className="sr-only">Log out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur md:hidden">
            <NavLink to="/" viewTransition aria-label="Ìtọ́ni dashboard">
              <Brand size="sm" />
            </NavLink>
            <div className="ml-auto flex items-center">
              <ThemeCycleButton />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Log out"
                className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
              >
                <LogOut aria-hidden className="size-5" />
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-10 lg:pt-10">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Phone tab bar: thumb reach, above the home indicator. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map((item) => (
          <TabLink key={item.to} item={item} unresolved={unresolved} />
        ))}
      </nav>
    </div>
  );
}

/** The mark alone, for the tablet icon rail. */
function BrandMark() {
  return (
    <span aria-hidden className="kanga-tile grid size-10 place-items-center rounded-xl shadow-lift">
      <span className="grid size-7 place-items-center rounded-lg bg-primary font-display text-lg font-semibold text-on-primary dark:bg-primary-strong">
        Ì
      </span>
    </span>
  );
}
