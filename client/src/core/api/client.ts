import { config } from "@/core/config";
import { secureStore } from "@/core/storage/secure";

export const AUTH_TOKEN_KEY = "vgyan.auth.token";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null
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

/** POST multipart form data (e.g. an image) and parse a JSON response. */
export async function postForm<T>(path: string, body: FormData, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, body, {}, opts);
}

async function request<T>(
  path: string,
  body: BodyInit,
  headers: Record<string, string>,
  { timeoutMs = 30_000 }: RequestOptions
): Promise<T> {
  const token = await secureStore.get(AUTH_TOKEN_KEY);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      method: "POST",
      body,
      headers: { Accept: "application/json", ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new ApiError(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof Error ? e.message : "Network error", null);
  } finally {
    clearTimeout(timer);
  }
}
