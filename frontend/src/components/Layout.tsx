import { ChartColumn, DoorOpen, Inbox, Languages, LayoutDashboard, LoaderCircle, PanelLeftClose, PanelLeftOpen, Plus, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { REPLIES_CHANGED } from "../lib/events";
import type { DashboardResponse } from "../lib/types";
import { useApi } from "../lib/useApi";
import { Brand } from "./Brand";
import { ConfirmDialog } from "./ConfirmDialog";
import { MockBanner } from "./MockBanner";
import { ThemeCycleButton, ThemeToggle } from "./ThemeToggle";
import { useToast } from "./Toaster";

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

const SIDEBAR_KEY = "itoni-sidebar";

/** Remembered per browser; a convenience, so failing storage just means "expanded". */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** Desktop classes that only apply while the sidebar is expanded (collapsed behaves like the tablet rail). */
const wideOnly = (wide: boolean, cls: string) => (wide ? cls : "");

/** Expanded desktop: icon + label. Collapsed or tablet: icon only (label as tooltip and for screen readers). */
function SideLink({ item, unresolved, wide }: { item: NavItem; unresolved: number; wide: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      viewTransition
      title={item.label}
      className={({ isActive }) =>
        `group relative z-10 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition md:justify-center ${wideOnly(wide, "lg:justify-start")} ${
          isActive ? "bg-primary-soft text-primary" : `text-muted hover:bg-surface-2 hover:text-ink ${wideOnly(wide, "lg:hover:bg-transparent")}`
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
              <span aria-hidden className={`absolute -top-1 -right-1 size-2.5 rounded-full bg-saffron ring-2 ring-surface ${wideOnly(wide, "lg:hidden")}`} />
            )}
          </span>
          <span className={`sr-only whitespace-nowrap ${wideOnly(wide, "lg:not-sr-only")}`}>{item.label}</span>
          {item.badge && <Badge count={unresolved} className={`ml-auto hidden ${wideOnly(wide, "lg:grid")}`} />}
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
  const toast = useToast();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const unresolved = useUnresolvedCount();
  const [hover, setHover] = useState<{ top: number; height: number } | null>(null);
  const hoverRef = useRef<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const wide = !collapsed;

  function toggleSidebar() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "expanded" : "collapsed");
      } catch {
        // Not remembered, still toggled for this visit.
      }
      return !c;
    });
  }

  function trackHover(e: MouseEvent<HTMLElement>) {
    const link = (e.target as HTMLElement).closest("a");
    if (!link || link === hoverRef.current) return;
    hoverRef.current = link;
    setHover({ top: link.offsetTop, height: link.offsetHeight });
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      // Network failure: the session is still valid server-side, so stay put and say so.
      setConfirmLogout(false);
      toast({ tone: "error", message: "Could not log out. Check your connection and try again." });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MockBanner show={mockMode} />
      <div className="flex flex-1">
        {/* Tablet: icon rail. Desktop: full sidebar that staff can collapse to the rail. Phones use the tab bar. */}
        {/* With the MOCK banner above it, the sidebar must be shorter by the banner's height or its footer is cut off. */}
        <aside
          aria-label="Sidebar"
          className={`sticky top-0 hidden w-20 shrink-0 flex-col gap-6 overflow-x-hidden overflow-y-auto border-r border-line bg-surface px-3 py-5 transition-[width] duration-200 ease-out md:flex ${wideOnly(wide, "lg:w-64 lg:px-4")} ${
            mockMode ? "h-[calc(100dvh-2.25rem)]" : "h-dvh"
          }`}
        >
          <div className={`flex flex-col items-center gap-3 ${wideOnly(wide, "lg:flex-row lg:justify-between lg:gap-2")}`}>
            <NavLink to="/" viewTransition className={`flex justify-center rounded-xl ${wideOnly(wide, "lg:justify-start lg:px-2")}`} aria-label="Ìtọ́ni dashboard">
              <span className={wideOnly(wide, "lg:hidden")}>
                <BrandMark />
              </span>
              <span className={`hidden ${wideOnly(wide, "lg:inline")}`}>
                <Brand size="md" />
              </span>
            </NavLink>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={wide}
              title={wide ? "Collapse sidebar" : "Expand sidebar"}
              className="hidden size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink lg:grid"
            >
              {wide ? <PanelLeftClose aria-hidden className="size-[18px]" /> : <PanelLeftOpen aria-hidden className="size-[18px]" />}
              <span className="sr-only">{wide ? "Collapse sidebar" : "Expand sidebar"}</span>
            </button>
          </div>
          <nav
            aria-label="Main"
            className="relative flex flex-col gap-1"
            onMouseOver={trackHover}
            onMouseLeave={() => {
              hoverRef.current = null;
              setHover(null);
            }}
          >
            {/* Expanded desktop: a soft marker glides to whichever link the cursor is on. */}
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-0 hidden rounded-xl bg-surface-2 transition-[transform,height,opacity] duration-200 ease-out ${wideOnly(wide, "lg:block")}`}
              style={{ transform: `translateY(${hover?.top ?? 0}px)`, height: hover?.height ?? 44, opacity: hover ? 1 : 0 }}
            />
            {NAV.map((item) => (
              <SideLink key={item.to} item={item} unresolved={unresolved} wide={wide} />
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <div className={`hidden ${wideOnly(wide, "lg:block")}`}>
              <ThemeToggle />
            </div>
            <div className={`flex justify-center ${wideOnly(wide, "lg:hidden")}`}>
              <ThemeCycleButton />
            </div>
            <div className={`flex items-center gap-2 rounded-xl border border-line p-1.5 ${wideOnly(wide, "lg:pl-3")}`}>
              <span className={`hidden min-w-0 flex-1 truncate text-sm font-medium text-ink ${wideOnly(wide, "lg:block")}`}>{user?.username}</span>
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                disabled={loggingOut}
                title="Log out"
                className={`mx-auto grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink ${wideOnly(wide, "lg:mx-0")}`}
              >
                {loggingOut ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <DoorOpen aria-hidden className="size-4" />}
                <span className="sr-only">Log out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            aria-hidden
            className="kanga-tile pointer-events-none absolute inset-x-0 top-0 h-64 opacity-[0.06] [mask-image:linear-gradient(to_bottom,black,transparent)] dark:opacity-[0.05]"
          />
          {/* Phone top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur md:hidden">
            <NavLink to="/" viewTransition aria-label="Ìtọ́ni dashboard">
              <Brand size="sm" />
            </NavLink>
            <div className="ml-auto flex items-center">
              <ThemeCycleButton />
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                disabled={loggingOut}
                aria-label="Log out"
                className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95"
              >
                {loggingOut ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <DoorOpen aria-hidden className="size-5" />}
              </button>
            </div>
          </header>

          <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-10 lg:pt-10">
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

      <ConfirmDialog
        open={confirmLogout}
        title="Log out of Ìtọ́ni?"
        confirmLabel="Log out"
        Icon={DoorOpen}
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      >
        You will need your username and password to sign back in. Patient links keep working.
      </ConfirmDialog>
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
