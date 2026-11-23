import { describe, expect, it } from "@jest/globals";
import { createMemoryRepository } from "@/core/db/memory-repository";
import { acquireSyncLock, releaseSyncLock } from "@/core/sync/lock";

describe("sync lock", () => {
  it("lets one runner in at a time and recovers from a stale lock", async () => {
    const repo = createMemoryRepository();
    const t = 1_000_000;
    expect(await acquireSyncLock(repo, "foreground", t)).toBe(true);
    expect(await acquireSyncLock(repo, "background", t + 1000)).toBe(false);
    // The same owner may re-enter (a second trigger in the same process).
    expect(await acquireSyncLock(repo, "foreground", t + 2000)).toBe(true);
    // A lock left behind by a killed process expires.
    expect(await acquireSyncLock(repo, "background", t + 11 * 60_000)).toBe(true);
    await releaseSyncLock(repo, "foreground"); // not the holder: no effect
    expect(await acquireSyncLock(repo, "foreground", t + 11 * 60_000 + 1)).toBe(false);
    await releaseSyncLock(repo, "background");
    expect(await acquireSyncLock(repo, "foreground", t + 11 * 60_000 + 2)).toBe(true);
  });
});
