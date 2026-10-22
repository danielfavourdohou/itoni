import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { MockBanner } from "../../components/MockBanner";
import { btnPrimary, card, fieldError, input, label } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

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
      navigate(from, { replace: true });
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
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span aria-hidden className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-teal-700 text-xl font-semibold text-white">
              Ì
            </span>
            <h1 className="text-2xl font-semibold text-slate-900">Ìtọ́ni</h1>
            <p className="mt-1 text-sm text-slate-500">Patient instructions in Swahili, as text and audio.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className={`${card} space-y-4 p-6`}>
            <h2 className="text-base font-semibold text-slate-900">Staff log in</h2>
            {error && (
              <div role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label htmlFor="username" className={label}>
                Username
              </label>
              <input
                id="username"
                className={input}
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={Boolean(fields.username)}
                aria-describedby={fields.username ? "username-error" : undefined}
              />
              {fields.username && (
                <p id="username-error" className={fieldError}>
                  {fields.username[0]}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className={label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                className={input}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fields.password)}
                aria-describedby={fields.password ? "password-error" : undefined}
              />
              {fields.password && (
                <p id="password-error" className={fieldError}>
                  {fields.password[0]}
                </p>
              )}
            </div>
            <button type="submit" className={`${btnPrimary} w-full py-2.5`} disabled={submitting}>
              {submitting && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {submitting ? "Logging in" : "Log in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
