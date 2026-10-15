import { createMemoryRepository, emptyState, MemoryState } from "./memory-repository";
import type { Repository } from "./types";

const STORAGE_KEY = "vgyan.db.v1";

/**
 * Web build only (development and demos): the same repository contract,
 * persisted to localStorage. The pilot runs on Android with SQLite.
 */
export function createRepository(): Repository {
  let initial: MemoryState = emptyState();
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) initial = { ...emptyState(), ...(JSON.parse(raw) as MemoryState) };
  } catch {
    // Corrupt or unavailable storage: start empty rather than crash.
  }
  return createMemoryRepository(initial, (state) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota or private mode: keep working in memory.
    }
  });
}
