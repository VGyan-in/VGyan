import { ApiError, AUTH_TOKEN_KEY, postJson } from "@/core/api/client";
import { secureStore } from "@/core/storage/secure";

/** Why a server auth call failed, in the terms the sign-in screens show. */
export type RemoteAuthError = "not-found" | "wrong-password" | "participant-exists" | "network" | "server";

export type RemoteAuthResult = { ok: true } | { ok: false; error: RemoteAuthError };

interface TokenResponse {
  access_token?: unknown;
}

/**
 * `POST /student/register`. Body keys follow the client's existing FastAPI backend
 * (StudentSkillManager `ServerSync.registerStudent`); `student_id` is the participant ID.
 */
export async function remoteRegister(input: {
  participantId: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<RemoteAuthResult> {
  try {
    await postJson("/student/register", {
      student_id: input.participantId,
      fullName: input.fullName,
      email: input.email,
      password: input.password,
    });
  } catch (e) {
    return { ok: false, error: toAuthError(e, { 409: "participant-exists", 400: "participant-exists" }) };
  }
  return remoteLogin(input.participantId, input.password);
}

/** `POST /student/login` → `{ access_token }`, stored in secure storage for the API client and uploader. */
export async function remoteLogin(participantId: string, password: string): Promise<RemoteAuthResult> {
  try {
    const res = await postJson<TokenResponse>("/student/login", { student_id: participantId, password });
    if (typeof res.access_token !== "string" || res.access_token === "") return { ok: false, error: "server" };
    await secureStore.set(AUTH_TOKEN_KEY, res.access_token);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toAuthError(e, { 401: "wrong-password", 403: "wrong-password", 404: "not-found" }) };
  }
}

export async function clearAuthToken() {
  await secureStore.remove(AUTH_TOKEN_KEY);
}

function toAuthError(e: unknown, byStatus: Record<number, RemoteAuthError>): RemoteAuthError {
  if (!(e instanceof ApiError) || e.status === null) return "network";
  return byStatus[e.status] ?? "server";
}
