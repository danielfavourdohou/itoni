import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, ApiError, setUnauthorizedHandler } from "./api";
import type { CsrfResponse, Session, User } from "./types";

type Status = "loading" | "ready";

interface AuthState {
  status: Status;
  user: User | null;
  mockMode: boolean;
  /** Set when the first load could not reach the API at all. */
  loadError: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setLoadError(null);
      try {
        // Sets the CSRF cookie and tells us about mock mode even before login. The first call of
        // a visit, so it waits out a sleeping Render instance; /me/ follows on a warm server.
        const csrf = await api.getWhileWaking<CsrfResponse>("/api/auth/csrf/", () => cancelled);
        if (cancelled) return;
        setMockMode(csrf.mock_mode);
        try {
          const session = await api.get<Session>("/api/auth/me/");
          if (!cancelled) setUser(session.user);
        } catch (err) {
          if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) throw err;
          if (!cancelled) setUser(null);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load the app.");
      } finally {
        if (!cancelled) setStatus("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const session = await api.post<Session>("/api/auth/login/", { username, password });
    setUser(session.user);
    setMockMode(session.mock_mode);
  }, []);

  const logout = useCallback(async () => {
    await api.post<void>("/api/auth/logout/");
    setUser(null);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ status, user, mockMode, loadError, login, logout, retry }),
    [status, user, mockMode, loadError, login, logout, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
