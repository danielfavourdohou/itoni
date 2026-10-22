import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const STORAGE_KEY = "itoni-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

// Patient pages always follow the phone's setting; only staff can override it.
const isPatientPath = () => window.location.pathname.startsWith("/p/");

function readStored(): ThemePreference {
  if (isPatientPath()) return "system";
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system"; // private mode or blocked storage
  }
}

function resolve(pref: ThemePreference): Resolved {
  if (pref !== "system") return pref;
  return media().matches ? "dark" : "light";
}

interface ThemeState {
  preference: ThemePreference;
  resolved: Resolved;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);
  const [resolved, setResolved] = useState<Resolved>(() => resolve(readStored()));

  useEffect(() => {
    const apply = () => {
      const next = resolve(preference);
      setResolved(next);
      document.documentElement.dataset.theme = next;
    };
    apply();
    if (preference !== "system") return;
    const mq = media();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    try {
      if (pref === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Not persisted, but still applied for this visit.
    }
    setPreferenceState(pref);
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
