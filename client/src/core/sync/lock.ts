import type { Repository } from "@/core/db/types";

const KEY = "sync.lock";
/** A lock older than this is assumed to belong to a run that was killed. */
const STALE_MS = 10 * 60_000;

/**
 * Cross-process mutex in SQLite so the foreground worker and the background task never upload the
 * same queue at the same time. (Uploads are idempotent on the server anyway; this avoids wasted data.)
 */
export async function acquireSyncLock(repo: Repository, owner: string, now = Date.now()): Promise<boolean> {
  const raw = await repo.getMeta(KEY);
  if (raw) {
    const [holder, ts] = raw.split("@");
    if (holder !== owner && now - Number(ts) < STALE_MS) return false;
  }
  await repo.setMeta(KEY, `${owner}@${now}`);
  // Re-read: if another runner wrote between our read and write, the later writer wins.
  return (await repo.getMeta(KEY)) === `${owner}@${now}`;
}

export async function releaseSyncLock(repo: Repository, owner: string): Promise<void> {
  const raw = await repo.getMeta(KEY);
  if (raw?.startsWith(`${owner}@`)) await repo.setMeta(KEY, null);
}
