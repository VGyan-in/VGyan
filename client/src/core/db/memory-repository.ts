import type {
  ConsentRecord,
  ReadingAttempt,
  SessionRecord,
  StudentProfile,
  SyncItem,
  WritingAttempt,
} from "@/types/models";
import type { Repository, StoredProfile } from "./types";

export interface MemoryState {
  meta: Record<string, string>;
  profiles: Record<string, StoredProfile>;
  consents: Record<string, ConsentRecord>;
  sessions: Record<string, SessionRecord>;
  reading: Record<string, ReadingAttempt>;
  writing: Record<string, WritingAttempt>;
  queue: Record<string, SyncItem>;
}

export const emptyState = (): MemoryState => ({
  meta: {},
  profiles: {},
  consents: {},
  sessions: {},
  reading: {},
  writing: {},
  queue: {},
});

const byCreatedDesc = <T extends { createdAt: string }>(xs: T[]) =>
  xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * In-memory repository. Backs the web build (persisted via `onChange`) and unit tests.
 * Records are deep-copied in and out so callers can't mutate stored state.
 */
export function createMemoryRepository(
  initial: MemoryState = emptyState(),
  onChange?: (state: MemoryState) => void
): Repository {
  const s = initial;
  const copy = <T,>(v: T): T => (v == null ? v : (JSON.parse(JSON.stringify(v)) as T));
  const commit = () => onChange?.(s);

  return {
    async init() {},

    async getMeta(key) {
      return s.meta[key] ?? null;
    },
    async setMeta(key, value) {
      if (value == null) delete s.meta[key];
      else s.meta[key] = value;
      commit();
    },

    async getProfile(pid) {
      return copy(s.profiles[pid] ?? null);
    },
    async findProfile(identifier) {
      const id = identifier.trim().toLowerCase();
      const hit = Object.values(s.profiles).find(
        (p) => p.profile.participantId.toLowerCase() === id || (p.profile.email && p.profile.email.toLowerCase() === id)
      );
      return copy(hit ?? null);
    },
    async saveProfile(profile: StudentProfile, credential) {
      const existing = s.profiles[profile.participantId];
      s.profiles[profile.participantId] = copy({
        profile,
        credential: credential !== undefined ? credential : existing?.credential ?? null,
      });
      commit();
    },

    async getConsent(pid) {
      const list = Object.values(s.consents)
        .filter((c) => c.participantId === pid)
        .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
      return copy(list[0] ?? null);
    },
    async getConsentById(id) {
      return copy(s.consents[id] ?? null);
    },
    async saveConsent(c) {
      s.consents[c.id] = copy(c);
      commit();
    },

    async saveSession(session) {
      s.sessions[session.sessionId] = copy(session);
      commit();
    },
    async getSession(id) {
      return copy(s.sessions[id] ?? null);
    },

    async listReading(pid) {
      return copy(byCreatedDesc(Object.values(s.reading).filter((a) => a.participantId === pid)));
    },
    async getReading(id) {
      return copy(s.reading[id] ?? null);
    },
    async saveReading(a) {
      s.reading[a.id] = copy(a);
      commit();
    },

    async listWriting(pid) {
      return copy(byCreatedDesc(Object.values(s.writing).filter((a) => a.participantId === pid)));
    },
    async getWriting(id) {
      return copy(s.writing[id] ?? null);
    },
    async saveWriting(a) {
      s.writing[a.id] = copy(a);
      commit();
    },

    async deleteParticipantData(pid) {
      for (const [id, a] of Object.entries(s.reading)) if (a.participantId === pid) delete s.reading[id];
      for (const [id, a] of Object.entries(s.writing)) if (a.participantId === pid) delete s.writing[id];
      for (const [id, q] of Object.entries(s.queue))
        if (q.participantId === pid && q.entityType !== "consent") delete s.queue[id];
      commit();
    },

    async listQueue() {
      return copy(Object.values(s.queue).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    },
    async getQueueItemFor(type, entityId) {
      return copy(Object.values(s.queue).find((q) => q.entityType === type && q.entityId === entityId) ?? null);
    },
    async saveQueueItem(item) {
      s.queue[item.id] = copy(item);
      commit();
    },
  };
}
