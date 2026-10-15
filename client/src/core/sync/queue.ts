import type { Repository } from "@/core/db/types";
import type { SyncEntityType, SyncItem } from "@/types/models";
import { nextRetryAt } from "./backoff";

export type UploadOutcome =
  | { kind: "ok" }
  /** Network error, timeout or 5xx: retry later with backoff. */
  | { kind: "retry"; error: string }
  /** 4xx validation error: needs a person to look at it; no automatic retry. */
  | { kind: "fatal"; error: string }
  /** No server configured yet: leave the item pending without counting an attempt. */
  | { kind: "skip"; error: string };

export type Uploader = (item: SyncItem) => Promise<UploadOutcome>;

/**
 * Adds an entity to the sync queue, or re-queues it if it changed after an
 * earlier upload (the backend upserts on the client-generated ID, so re-sending is safe).
 */
export async function enqueue(
  repo: Repository,
  entityType: SyncEntityType,
  entityId: string,
  participantId: string,
  newId: () => string,
  now = new Date()
): Promise<void> {
  const existing = await repo.getQueueItemFor(entityType, entityId);
  const ts = now.toISOString();
  await repo.saveQueueItem(
    existing
      ? { ...existing, status: "pending", attempts: 0, permanent: false, lastError: null, nextRetryAt: null, updatedAt: ts }
      : {
          id: newId(),
          entityType,
          entityId,
          participantId,
          status: "pending",
          attempts: 0,
          lastError: null,
          permanent: false,
          nextRetryAt: null,
          createdAt: ts,
          updatedAt: ts,
        }
  );
}

/** Items interrupted mid-upload (app killed) go back to pending on start. */
export async function resetInterrupted(repo: Repository, now = new Date()) {
  for (const item of await repo.listQueue()) {
    if (item.status === "uploading") {
      await repo.saveQueueItem({ ...item, status: "pending", updatedAt: now.toISOString() });
    }
  }
}

export function isDue(item: SyncItem, maxRetries: number, now: Date): boolean {
  if (item.status === "pending") return !item.nextRetryAt || new Date(item.nextRetryAt) <= now;
  if (item.status === "failed") {
    if (item.permanent || item.attempts >= maxRetries) return false;
    return !item.nextRetryAt || new Date(item.nextRetryAt) <= now;
  }
  return false;
}

export interface SyncRunResult {
  synced: SyncItem[];
  failed: number;
  skipped: number;
}

/**
 * One pass over the queue, oldest first. Each item is claimed (`uploading`),
 * uploaded, then marked `synced`, or `failed` with backoff / as permanent.
 */
export async function processQueue(
  repo: Repository,
  upload: Uploader,
  opts: { maxRetries: number; now?: () => Date; random?: () => number }
): Promise<SyncRunResult> {
  const now = opts.now ?? (() => new Date());
  const result: SyncRunResult = { synced: [], failed: 0, skipped: 0 };

  const due = (await repo.listQueue()).filter((i) => isDue(i, opts.maxRetries, now()));
  for (const item of due) {
    const claimed: SyncItem = { ...item, status: "uploading", updatedAt: now().toISOString() };
    await repo.saveQueueItem(claimed);

    let outcome: UploadOutcome;
    try {
      outcome = await upload(claimed);
    } catch (e) {
      outcome = { kind: "retry", error: e instanceof Error ? e.message : String(e) };
    }

    const ts = now();
    // If the record changed and was re-queued while uploading, leave it pending
    // so the newer version is sent on the next pass.
    const current = await repo.getQueueItemFor(claimed.entityType, claimed.entityId);
    if (current && current.updatedAt !== claimed.updatedAt) continue;

    if (outcome.kind === "ok") {
      const done: SyncItem = { ...claimed, status: "synced", lastError: null, nextRetryAt: null, updatedAt: ts.toISOString() };
      await repo.saveQueueItem(done);
      result.synced.push(done);
    } else if (outcome.kind === "skip") {
      await repo.saveQueueItem({ ...claimed, status: "pending", lastError: outcome.error, updatedAt: ts.toISOString() });
      result.skipped += 1;
    } else {
      const attempts = claimed.attempts + 1;
      const permanent = outcome.kind === "fatal";
      await repo.saveQueueItem({
        ...claimed,
        status: "failed",
        attempts,
        permanent,
        lastError: outcome.error,
        nextRetryAt: permanent ? null : nextRetryAt(attempts, ts, opts.random),
        updatedAt: ts.toISOString(),
      });
      result.failed += 1;
    }
  }
  return result;
}

/** Manual "retry" from the sync details screen: clears backoff and the permanent flag. */
export async function retryItem(repo: Repository, item: SyncItem, now = new Date()) {
  await repo.saveQueueItem({
    ...item,
    status: "pending",
    attempts: 0,
    permanent: false,
    nextRetryAt: null,
    updatedAt: now.toISOString(),
  });
}
