// The only way the app talks to the backend. Same origin (Vite proxy in dev, Django in
// production), so the session cookie rides along and CSRF is a header copied from a cookie.
import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string[]>;
  /** Parsed JSON error body, for endpoints that send more than {error, fields}. */
  readonly body: unknown;

  constructor(status: number, message: string, fields: Record<string, string[]> = {}, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.body = body;
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let onUnauthorized: (() => void) | null = null;

/** AuthProvider registers this so any 401 outside /api/auth/ sends the user back to login. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Please log in.";
  if (status === 403) return "You do not have access to this.";
  if (status === 404) return "Not found.";
  if (status === 413) return "The file is too large.";
  if (status === 429) return "Too many requests. Please wait and try again.";
  if (status >= 500) return "The server had a problem. Please try again.";
  return "Something went wrong.";
}

/**
 * Our API sends {error: "text"}. A proxy in front of it (Vercel) can answer with its own
 * {error: {code, message}}, which must not reach the screen as "[object Object]".
 */
function errorMessage(error: unknown, status: number): string {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const { message, code } = error as { message?: unknown; code?: unknown };
    if (typeof message === "string" && message) return typeof code === "string" ? `${message} (${code})` : message;
  }
  return fallbackMessage(status);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // the browser sets the multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (UNSAFE.has(method)) {
    // Read on every call: Django rotates the token at login.
    const token = readCookie("csrftoken");
    if (token) headers["X-CSRFToken"] = token;
  }

  let resp: Response;
  try {
    resp = await fetch(path, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (resp.status === 204) return undefined as T;

  const isJson = (resp.headers.get("Content-Type") ?? "").includes("application/json");
  const data: unknown = isJson ? await resp.json().catch(() => null) : null;

  if (!resp.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    if (resp.status === 401 && !path.startsWith("/api/auth/")) onUnauthorized?.();
    throw new ApiError(resp.status, errorMessage(err.error, resp.status), err.fields ?? {}, data);
  }
  // A 200 that is not JSON means something in front of the API answered instead (a proxy
  // rewrite falling through to index.html, a captive portal). Say so rather than crash on null.
  if (!isJson) throw new ApiError(resp.status, "The server sent an unexpected response. Please try again.");
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};
