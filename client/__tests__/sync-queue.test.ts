import { describe, expect, it } from "@jest/globals";
import { createMemoryRepository } from "@/core/db/memory-repository";
import type { Repository } from "@/core/db/types";
import {
  enqueue,
  isDue,
  processQueue,
  resetInterrupted,
  retryItem,
  UploadOutcome,
} from "@/core/sync/queue";
import type { SyncItem } from "@/types/models";

let counter = 0;
const newId = () => `id-${++counter}`;
const T0 = new Date("2026-10-15T10:00:00.000Z");

async function setup(...entityIds: string[]) {
  const repo = createMemoryRepository();
  for (const id of entityIds) await enqueue(repo, "reading", id, "VG-1", newId, T0);
  return repo;
}

const run = (repo: Repository, outcome: (i: SyncItem) => UploadOutcome, now = T0) =>
  processQueue(repo, async (i) => outcome(i), { maxRetries: 3, now: () => now, random: () => 0 });

describe("sync queue", () => {
  it("marks items synced on success", async () => {
    const repo = await setup("a", "b");
    const result = await run(repo, () => ({ kind: "ok" }));
    expect(result.synced).toHaveLength(2);
    expect((await repo.listQueue()).every((i) => i.status === "synced")).toBe(true);
  });

  it("schedules a retry with backoff on network errors", async () => {
    const repo = await setup("a");
    await run(repo, () => ({ kind: "retry", error: "Network error" }));
    const [item] = await repo.listQueue();
    expect(item).toMatchObject({ status: "failed", attempts: 1, permanent: false });
    expect(new Date(item.nextRetryAt!).getTime()).toBeGreaterThan(T0.getTime());
    expect(isDue(item, 3, T0)).toBe(false);
    expect(isDue(item, 3, new Date(item.nextRetryAt!))).toBe(true);
  });

  it("does not retry 4xx validation failures automatically", async () => {
    const repo = await setup("a");
    await run(repo, () => ({ kind: "fatal", error: "HTTP 422" }));
    const [item] = await repo.listQueue();
    expect(item.permanent).toBe(true);
    expect(isDue(item, 3, new Date("2030-01-01"))).toBe(false);
  });

  it("stops after the max retry count until a manual retry", async () => {
    const repo = await setup("a");
    let now = T0;
    for (let i = 0; i < 3; i++) {
      await run(repo, () => ({ kind: "retry", error: "HTTP 503" }), now);
      now = new Date(now.getTime() + 2 * 60 * 60_000);
    }
    let [item] = await repo.listQueue();
    expect(item.attempts).toBe(3);
    expect(isDue(item, 3, now)).toBe(false);

    await retryItem(repo, item, now);
    [item] = await repo.listQueue();
    expect(item).toMatchObject({ status: "pending", attempts: 0 });
    expect(isDue(item, 3, now)).toBe(true);
  });

  it("leaves items pending without counting attempts when no server is configured", async () => {
    const repo = await setup("a");
    const result = await run(repo, () => ({ kind: "skip", error: "no server" }));
    expect(result.skipped).toBe(1);
    const [item] = await repo.listQueue();
    expect(item).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("treats a thrown uploader error as retryable", async () => {
    const repo = await setup("a");
    await processQueue(
      repo,
      async () => {
        throw new Error("boom");
      },
      { maxRetries: 3, now: () => T0 }
    );
    const [item] = await repo.listQueue();
    expect(item).toMatchObject({ status: "failed", lastError: "boom", permanent: false });
  });

  it("re-queues a synced item when the record changes", async () => {
    const repo = await setup("a");
    await run(repo, () => ({ kind: "ok" }));
    await enqueue(repo, "reading", "a", "VG-1", newId, new Date(T0.getTime() + 1000));
    const items = await repo.listQueue();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("pending");
  });

  it("keeps an item pending if it changed while uploading", async () => {
    const repo = await setup("a");
    await processQueue(
      repo,
      async () => {
        await enqueue(repo, "reading", "a", "VG-1", newId, new Date(T0.getTime() + 5000));
        return { kind: "ok" };
      },
      { maxRetries: 3, now: () => T0 }
    );
    const [item] = await repo.listQueue();
    expect(item.status).toBe("pending");
  });

  it("resets interrupted uploads on start", async () => {
    const repo = await setup("a");
    const [item] = await repo.listQueue();
    await repo.saveQueueItem({ ...item, status: "uploading" });
    await resetInterrupted(repo, T0);
    expect((await repo.listQueue())[0].status).toBe("pending");
  });
});
