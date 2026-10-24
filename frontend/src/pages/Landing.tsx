import { AudioLines, Binary, Ear, HandHeart, Languages, Mic, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Brand, BrandWord } from "../components/Brand";
import { HeroStage, HeroSurface, KangaLight } from "../components/HeroStage";
import { StepCreate, StepHandover, StepListen } from "../components/Illustrations";
import { KangaBand } from "../components/Kanga";
import { MockBanner } from "../components/MockBanner";
import { ThemeToggle } from "../components/ThemeToggle";
import { btnPrimary, btnSecondary } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const STEPS = [
  {
    title: "Create",
    body: <>Staff pick standard instructions and fill in the dose and dates. <BrandWord /> translates them into Swahili and records the audio.</>,
    Art: StepCreate,
  },
  {
    title: "Hand over",
    body: "Show the QR code at the counter. The patient scans it with their phone camera: no app and no account.",
    Art: StepHandover,
  },
  {
    title: "Listen and reply",
    body: "The patient reads and hears each instruction, with the numbers shown as digits, and can ask a question back by voice.",
    Art: StepListen,
  },
];

const SAFETY: { Icon: typeof Binary; title: string; body: ReactNode }[] = [
  { Icon: Binary, title: "Numbers always as digits", body: "Dose, times a day, days and the return date are shown as digits, so a mistranslated number is still visible." },
  { Icon: UserCheck, title: "Human review built in", body: "Each sentence can be checked and approved by a fluent Swahili reader. Unreviewed wording is clearly marked for staff." },
  { Icon: Mic, title: "Voice only after consent", body: "Patients tick a consent box, in Swahili, before anything is recorded." },
  { Icon: HandHeart, title: "A person reads every reply", body: "Replies are never answered automatically. Staff listen, read the English and follow up." },
  { Icon: ShieldCheck, title: "Not a medical device", body: <><BrandWord /> delivers instructions a clinician has already decided. It gives no medical advice.</> },
];

const APIS: { Icon: typeof Languages; name: string; role: string }[] = [
  { Icon: Languages, name: "Text-to-Text", role: "Translates each instruction template into Swahili once, then serves it from cache." },
  { Icon: AudioLines, name: "Text-to-Speech", role: "Voices each unique Swahili sentence once; the audio is cached by its content." },
  { Icon: Ear, name: "Speech Translation", role: "Turns a patient's Swahili voice note into English text in a single call." },
];

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 py-16 sm:py-20">
      <div className="max-w-2xl">
        <h2 id={`${id}-h`} className="font-display text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">
          {title}
        </h2>
        {intro && <p className="mt-3 text-muted">{intro}</p>}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

/** The public sample patient, if seed_demo has published one (404 means none, so no button). */
function useDemoPath(): string | null {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ patient_path: string }>("/api/demo/")
      .then((r) => !cancelled && setPath(r.patient_path))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return path;
}

/** Public front door at / for visitors. Logged-in staff go straight to their dashboard instead. */
export function Landing() {
  const { mockMode } = useAuth();
  const demoPath = useDemoPath();
  return (
    <div className="relative isolate min-h-dvh">
      <KangaLight />
      <MockBanner show={mockMode} />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Brand size="sm" />
          <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 text-sm font-medium text-muted md:flex">
            {[
              ["#how", "How it works"],
              ["#safety", "Safety"],
              ["#nkenneai", "Built with NKENNEAi"],
            ].map(([href, text]) => (
              <a key={href} href={href} className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">
                {text}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:block">
              <ThemeToggle compact />
            </span>
            <Link to="/login" viewTransition className={`${btnPrimary} min-h-10`}>
              Staff login
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero over the kanga cloth; the cursor's light brings the pattern up (HeroSurface). */}
        <HeroSurface>
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20 lg:pb-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm font-medium text-muted shadow-lift">
                <span aria-hidden className="size-2 rounded-full bg-saffron" />
                Patient instructions in Swahili
              </p>
              <h1 className="mt-5 font-display text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-ink sm:text-[44px]">
                Every patient leaves knowing what to do.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                <BrandWord /> turns a clinic's standard instructions into Swahili text and speech. Patients scan a QR code, listen on
                their own phone, and can ask a question back by voice. Staff read it in English.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/login" viewTransition className={`${btnPrimary} min-h-12 px-6 text-base`}>
                  Staff login
                </Link>
                {demoPath ? (
                  // Opens the public sample patient: what a patient sees after scanning the QR code.
                  <a href={demoPath} target="_blank" rel="noreferrer" className={`${btnSecondary} min-h-12 px-6 text-base`}>
                    <Smartphone aria-hidden className="size-4" />
                    See a patient's screen
                  </a>
                ) : (
                  <a href="#how" className={`${btnSecondary} min-h-12 px-6 text-base`}>
                    See how it works
                  </a>
                )}
              </div>
              {demoPath && <p className="mt-3 text-sm text-muted">A sample patient, no login needed.</p>}
            </div>
            <HeroStage />
          </div>
        </HeroSurface>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Section id="how" title="How it works" intro="Three steps at the counter. The first two take staff under a minute.">
            <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map(({ title, body, Art }, i) => (
                <li key={title}>
                  <div className="grid aspect-[4/3] place-items-center rounded-3xl bg-surface-2/60">
                    <Art className="w-3/4" />
                  </div>
                  <h3 className="mt-5 flex items-baseline gap-2.5 font-display text-lg font-semibold text-ink">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm text-on-primary">{i + 1}</span>
                    {title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </Section>

          <div className="border-t border-line">
            <Section
              id="safety"
              title="Safety and honesty"
              intro="A wrong dose is a safety problem, not a typo. These rules are built into the product."
            >
              <ul className="grid gap-x-12 divide-y divide-line md:grid-cols-2 md:divide-y-0">
                {SAFETY.map(({ Icon, title, body }) => (
                  <li key={title} className="flex gap-4 py-5 md:border-t md:border-line">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <span>
                      <span className="block font-semibold text-ink">{title}</span>
                      <span className="mt-1 block leading-relaxed text-muted">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

        </div>

        {/* The page's high point: one full-width indigo band edged with the kanga cloth. */}
        <section id="nkenneai" aria-labelledby="nkenneai-h" className="scroll-mt-20 bg-[#2B3A9F] text-white">
          <KangaBand />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <h2 id="nkenneai-h" className="font-display text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">
                Built with NKENNEAi
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-white/80">
                Three NKENNEAi APIs carry the whole loop. Every call is logged, and content already processed is served
                from the cache, so a sentence is never paid for twice.
              </p>
            </div>
            <ol className="divide-y divide-white/15 border-y border-white/15">
              {APIS.map(({ Icon, name, role }) => (
                <li key={name} className="group flex gap-4 py-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#F2A900] text-[#1B1F3B] transition group-hover:-rotate-6 group-hover:scale-105">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{name}</span>
                    <span className="mt-1 block leading-relaxed text-white/75">{role}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <KangaBand />
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <Brand size="sm" />
            <p>Built for the Build With NKENNEAi Hackathon, October 2026. Swahili only, by hackathon rule.</p>
          </div>
          <Link to="/login" viewTransition className="font-semibold text-primary hover:underline">
            Staff login
          </Link>
        </div>
      </footer>
    </div>
  );
}
