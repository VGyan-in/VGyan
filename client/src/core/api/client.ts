import { config } from "@/core/config";
import { secureStore } from "@/core/storage/secure";

export const AUTH_TOKEN_KEY = "vgyan.auth.token";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  timeoutMs?: number;
}

/** POST a JSON body to the backend and parse a JSON response. Throws ApiError on any failure. */
export async function postJson<T>(path: string, payload: unknown, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, JSON.stringify(payload), { "Content-Type": "application/json" }, opts);
}

/** PATCH a JSON body. */
export async function patchJson<T>(path: string, payload: unknown, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, JSON.stringify(payload), { "Content-Type": "application/json" }, opts, "PATCH");
}

/** GET a JSON resource. */
export async function getJson<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, undefined, {}, opts, "GET");
}

/** POST multipart form data (e.g. an image) and parse a JSON response. */
export async function postForm<T>(path: string, body: FormData, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, body, {}, opts);
}

async function request<T>(
  path: string,
  body: BodyInit | undefined,
  headers: Record<string, string>,
  { timeoutMs = 30_000 }: RequestOptions,
  method: "GET" | "POST" | "PATCH" = "POST"
): Promise<T> {
  const token = await secureStore.get(AUTH_TOKEN_KEY);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      body,
      headers: { Accept: "application/json", ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let code: string | null = null;
      let message = raw.slice(0, 200);
      try {
        const j = JSON.parse(raw);
        code = j?.error?.code ?? null;
        message = j?.error?.message ?? j?.detail ?? message;
      } catch {
        // not JSON
      }
      throw new ApiError(`HTTP ${res.status}${message ? `: ${message}` : ""}`, res.status, code);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof Error ? e.message : "Network error", null);
  } finally {
    clearTimeout(timer);
  }
}
