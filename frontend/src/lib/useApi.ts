import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "./api";

interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  /** Replace the data locally (optimistic updates) without refetching. */
  setData: (update: (prev: T | null) => T | null) => void;
}

interface Options {
  /** Refetch in the background every N ms while the tab is visible. Keeps the old data on screen. */
  pollMs?: number;
}

/** GET a resource on mount (and whenever `path` changes). No caching: screens are small. */
export function useApi<T>(path: string, { pollMs }: Options = {}): ApiState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    hasData.current = false;
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((result) => {
        if (cancelled) return;
        hasData.current = true;
        setDataState(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !hasData.current) return;
      // Silent refresh: a failed poll keeps the current data rather than flashing an error.
      api.get<T>(path).then(setDataState).catch(() => undefined);
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [path, pollMs]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback((update: (prev: T | null) => T | null) => setDataState(update), []);
  return { data, error, loading, reload, setData };
}
