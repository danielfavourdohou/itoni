import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Brand } from "../../components/Brand";
import { KangaBand, KangaFrame } from "../../components/Kanga";
import { MockBanner } from "../../components/MockBanner";
import { ThemeToggle } from "../../components/ThemeToggle";
import { btnPrimary, fieldError, input, label } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

function Field({
  id,
  text,
  type = "text",
  autoComplete,
  value,
  onChange,
  errors,
  autoFocus,
}: {
  id: string;
  text: string;
  type?: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  errors?: string[];
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        type={type}
        className={input}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(errors)}
        aria-describedby={errors ? `${id}-error` : undefined}
      />
      {errors && (
        <p id={`${id}-error`} className={fieldError}>
          {errors[0]}
        </p>
      )}
    </div>
  );
}

export function Login() {
  const { user, mockMode, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFields({});
    try {
      await login(username, password);
      navigate(from, { replace: true, viewTransition: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MockBanner show={mockMode} />
      <KangaBand className="lg:hidden" />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Desktop: the kanga-framed statement of what the app is for. */}
        <div className="hidden p-6 lg:flex">
          <KangaFrame className="flex flex-1" innerClassName="flex flex-1 flex-col justify-between overflow-hidden !bg-[#2B3A9F] p-12 text-white">
            <Brand size="lg" tone="light" />
            <div className="max-w-lg">
              <p className="font-display text-5xl leading-[1.08] font-semibold tracking-tight text-balance">
                Every patient leaves knowing what to do.
              </p>
              <p className="mt-6 text-lg leading-relaxed text-white/80">
                Turn standard instructions into Swahili text and speech, hand them over with a QR code, and read
                patients' spoken questions in English.
              </p>
            </div>
            <p className="text-sm text-white/60">For clinic and pharmacy staff.</p>
          </KangaFrame>
        </div>

        <div className="flex flex-col px-5 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <span className="lg:invisible">
              <Brand size="md" />
            </span>
            <ThemeToggle compact />
          </div>

          <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Welcome back</h1>
            <p className="mt-2 text-muted">Log in with your clinic staff account.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
              {error && (
                <div role="alert" className="flex gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-sm text-danger-ink">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              )}
              <Field id="username" text="Username" autoComplete="username" autoFocus value={username} onChange={setUsername} errors={fields.username} />
              <Field
                id="password"
                text="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                errors={fields.password}
              />
              <button type="submit" className={`${btnPrimary} w-full min-h-12 text-base`} disabled={submitting}>
                {submitting && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
                {submitting ? "Logging in" : "Log in"}
              </button>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
