import { Platform } from "react-native";
import { config, isServerConfigured } from "@/core/config";
import type { Repository } from "@/core/db/types";
import { secureStore } from "@/core/storage/secure";
import type { SyncItem } from "@/types/models";
import type { Uploader, UploadOutcome } from "./queue";

export const AUTH_TOKEN_KEY = "vgyan.auth.token";

const ENDPOINTS: Record<SyncItem["entityType"], string> = {
  reading: "/sync/reading",
  writing: "/sync/writing",
  consent: "/sync/consent",
};

const TIMEOUT_MS = 60_000;

/**
 * Builds the uploader used by the sync worker. Each record goes as multipart:
 * a `record` JSON field plus the original audio or image file. The backend must
 * upsert on the record ID; 2xx and 409 both count as received.
 */
export function createUploader(repo: Repository): Uploader {
  return async (item): Promise<UploadOutcome> => {
    if (!isServerConfigured()) {
      if (config.simulateSync) {
        await new Promise((r) => setTimeout(r, 300));
        return { kind: "ok" };
      }
      return { kind: "skip", error: "Server not configured yet. Data is kept on this phone." };
    }

    const body = new FormData();
    let fileUri: string | null = null;
    let fileName = "";
    let mime = "";

    if (item.entityType === "reading") {
      const a = await repo.getReading(item.entityId);
      if (!a) return { kind: "fatal", error: "Record no longer exists on this phone" };
      const session = await repo.getSession(a.sessionId);
      body.append("record", JSON.stringify({ ...a, session }));
      fileUri = a.audioUri;
      fileName = `${a.id}.${fileExt(a.audioUri, "m4a")}`;
      mime = "audio/mp4";
    } else if (item.entityType === "writing") {
      const a = await repo.getWriting(item.entityId);
      if (!a) return { kind: "fatal", error: "Record no longer exists on this phone" };
      const session = await repo.getSession(a.sessionId);
      body.append("record", JSON.stringify({ ...a, session }));
      fileUri = a.imageUri;
      fileName = `${a.id}.${fileExt(a.imageUri, "jpg")}`;
      mime = "image/jpeg";
    } else {
      const c = await repo.getConsentById(item.entityId);
      if (!c) return { kind: "fatal", error: "Consent record missing" };
      body.append("record", JSON.stringify(c));
    }

    if (fileUri) {
      if (Platform.OS === "web") {
        const blob = await (await fetch(fileUri)).blob();
        body.append("file", blob, fileName);
      } else {
        // React Native FormData accepts { uri, name, type } for file parts.
        body.append("file", { uri: fileUri, name: fileName, type: mime } as unknown as Blob);
      }
    }

    const token = await secureStore.get(AUTH_TOKEN_KEY);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${config.apiBaseUrl}${ENDPOINTS[item.entityType]}`, {
        method: "POST",
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      if (res.ok || res.status === 409) return { kind: "ok" };
      const detail = await safeText(res);
      if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) {
        return { kind: "retry", error: `HTTP ${res.status}${detail ? `: ${detail}` : ""}` };
      }
      return { kind: "fatal", error: `HTTP ${res.status}${detail ? `: ${detail}` : ""}` };
    } catch (e) {
      return { kind: "retry", error: e instanceof Error ? e.message : "Network error" };
    } finally {
      clearTimeout(timer);
    }
  };
}

function fileExt(uri: string | null, fallback: string) {
  const m = uri ? /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(uri) : null;
  return m ? m[1].toLowerCase() : fallback;
}

async function safeText(res: Response) {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}
