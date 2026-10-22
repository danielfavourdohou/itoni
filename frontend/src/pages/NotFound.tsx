import { ArrowLeft, House } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Brand } from "../components/Brand";
import { LostPage } from "../components/Illustrations";
import { MockBanner } from "../components/MockBanner";
import { ThemeToggle } from "../components/ThemeToggle";
import { btnPrimary, btnSecondary } from "../components/ui";
import { useAuth } from "../lib/auth";

/** Staff and public 404 (patient links have their own translated "link expired" screen). */
export function NotFound() {
  const { mockMode } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col">
      <MockBanner show={mockMode} />
      <header className="border-b border-line/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" viewTransition aria-label="Ìtọ́ni home" className="rounded-xl">
            <Brand size="sm" />
          </Link>
          <ThemeToggle compact />
        </div>
      </header>

      <main className="relative flex flex-1 items-center overflow-hidden">
        <div aria-hidden className="kanga-tile absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)] dark:opacity-[0.05]" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-2 lg:order-1">
            <p className="font-display text-6xl leading-none font-semibold text-primary tabular-nums">404</p>
            <h1 className="mt-4 font-display text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">
              This page does not exist.
            </h1>
            <p className="mt-3 max-w-md leading-relaxed text-muted">
              The address may be mistyped, or the page has moved. Check the link, or start again from the home page.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/" viewTransition className={`${btnPrimary} min-h-12 px-6 text-base`}>
                <House aria-hidden className="size-4" />
                Go to the home page
              </Link>
              <button type="button" onClick={() => navigate(-1)} className={`${btnSecondary} min-h-12 px-6 text-base`}>
                <ArrowLeft aria-hidden className="size-4" />
                Go back
              </button>
            </div>
          </div>
          <LostPage className="order-1 mx-auto w-full max-w-xs lg:order-2 lg:max-w-sm" />
        </div>
      </main>
    </div>
  );
}
