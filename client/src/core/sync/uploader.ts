import { Platform } from "react-native";
import { AUTH_TOKEN_KEY } from "@/core/api/client";
import { config, isServerConfigured } from "@/core/config";
import type { Repository } from "@/core/db/types";
import { secureStore } from "@/core/storage/secure";
import { localMd5 } from "@/core/storage/files";
import type { ReadingAttempt, SyncItem, WritingAttempt } from "@/types/models";
import type { Uploader, UploadOutcome } from "./queue";

export { AUTH_TOKEN_KEY };

const ENDPOINTS: Record<SyncItem["entityType"], string> = {
  reading: "/sync/reading",
  writing: "/sync/writing",
  consent: "/sync/consent",
};

const TIMEOUT_MS = 120_000;

const MIME: Record<string, string> = {
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Fields that only make sense on this phone; never part of the research record. */
const LOCAL_ONLY = ["synced", "serverFileMd5", "audioUri", "imageUri"] as const;

/** What the server receives for a reading attempt. Pending transcriptions carry no metrics. */
export function readingPayload(a: ReadingAttempt, md5: string | null) {
  const rec: Record<string, unknown> = { ...a, audioMd5: md5 };
  for (const k of LOCAL_ONLY) delete rec[k];
  if (a.asrStatus === "pending") {
    for (const k of ["accuracy", "wpm", "wcpm", "mistakesCount", "substitutions", "omissions", "insertions"]) rec[k] = null;
    rec.words = [];
    rec.practiceWords = [];
    rec.transcript = "";
  }
  return rec;
}

export function writingPayload(a: WritingAttempt, md5: string | null) {
  const rec: Record<string, unknown> = { ...a, imageMd5: md5 };
  for (const k of LOCAL_ONLY) delete rec[k];
  return rec;
}

/**
 * Builds the uploader used by the sync worker. Each record goes as multipart: a `record` JSON field
 * plus the original audio or image. The backend upserts on the record ID, so retries are safe.
 * Status handling mirrors backend/app/api/sync.py.
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
    const token = await secureStore.get(AUTH_TOKEN_KEY);
    if (!token) return { kind: "skip", error: "Sign in online once to upload. Data is kept on this phone." };

    const body = new FormData();
    let fileUri: string | null = null;
    let md5: string | null = null;

    if (item.entityType === "reading") {
      const a = await repo.getReading(item.entityId);
      if (!a) return { kind: "fatal", error: "Record no longer exists on this phone" };
      fileUri = a.audioUri;
      md5 = localMd5(fileUri);
      const session = await repo.getSession(a.sessionId);
      body.append("record", JSON.stringify({ ...readingPayload(a, md5), session }));
    } else if (item.entityType === "writing") {
      const a = await repo.getWriting(item.entityId);
      if (!a) return { kind: "fatal", error: "Record no longer exists on this phone" };
      fileUri = a.imageUri;
      md5 = localMd5(fileUri);
      const session = await repo.getSession(a.sessionId);
      body.append("record", JSON.stringify({ ...writingPayload(a, md5), session }));
    } else {
      const c = await repo.getConsentById(item.entityId);
      if (!c) return { kind: "fatal", error: "Consent record missing" };
      body.append("record", JSON.stringify(c));
    }

    if (fileUri && md5) {
      const ext = fileExt(fileUri);
      const name = `${item.entityId}.${ext}`;
      const type = MIME[ext] ?? "application/octet-stream";
      if (Platform.OS === "web") {
        body.append("file", await (await fetch(fileUri)).blob(), name);
      } else {
        // React Native FormData accepts { uri, name, type } for file parts.
        body.append("file", { uri: fileUri, name, type } as unknown as Blob);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${config.apiBaseUrl}${ENDPOINTS[item.entityType]}`, {
        method: "POST",
        body,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });
      if (res.ok) {
        const receipt = (await res.json().catch(() => null)) as { file_md5?: string | null } | null;
        await recordReceipt(repo, item, receipt?.file_md5 ?? null);
        return { kind: "ok" };
      }
      // Older servers answered duplicates with 409; the record is there either way.
      if (res.status === 409) return { kind: "ok" };
      const detail = await errorDetail(res);
      const msg = `HTTP ${res.status}${detail ? `: ${detail}` : ""}`;
      // 428: consent not on the server yet (it is queued earlier and will arrive); 401: sign in again.
      if ([401, 408, 425, 428, 429].includes(res.status) || res.status >= 500) return { kind: "retry", error: msg };
      return { kind: "fatal", error: msg };
    } catch (e) {
      return { kind: "retry", error: e instanceof Error ? e.message : "Network error" };
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Remember which exact file the server confirmed, so local media is only ever purged after that. */
async function recordReceipt(repo: Repository, item: SyncItem, serverMd5: string | null) {
  if (item.entityType === "reading") {
    const a = await repo.getReading(item.entityId);
    if (a && a.serverFileMd5 !== serverMd5) await repo.saveReading({ ...a, serverFileMd5: serverMd5 });
  } else if (item.entityType === "writing") {
    const a = await repo.getWriting(item.entityId);
    if (a && a.serverFileMd5 !== serverMd5) await repo.saveWriting({ ...a, serverFileMd5: serverMd5 });
  }
}

function fileExt(uri: string) {
  const m = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(uri);
  return m ? m[1].toLowerCase() : "bin";
}

async function errorDetail(res: Response) {
  try {
    const raw = await res.text();
    try {
      const j = JSON.parse(raw);
      return String(j?.error?.message ?? j?.detail ?? raw).slice(0, 200);
    } catch {
      return raw.slice(0, 200);
    }
  } catch {
    return "";
  }
}
