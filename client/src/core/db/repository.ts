import * as SQLite from "expo-sqlite";
import type {
  ConsentRecord,
  ReadingAttempt,
  SessionRecord,
  StudentProfile,
  SyncEntityType,
  SyncItem,
  WritingAttempt,
} from "@/types/models";
import type { Repository, StoredProfile } from "./types";

const DB_NAME = "vgyan.db";

/**
 * Schema migrations, applied in order and tracked with PRAGMA user_version.
 * Attempts keep their indexed columns explicit and the full record in `payload`
 * (JSON), so the on-device record is never lossy.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
  CREATE TABLE IF NOT EXISTS profile (
    participant_id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL,
    email TEXT,
    credential TEXT,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY NOT NULL,
    participant_id TEXT NOT NULL,
    consent_version TEXT NOT NULL,
    status TEXT NOT NULL,
    accepted_at TEXT NOT NULL,
    withdrawn_at TEXT,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_consent_participant ON consent_records (participant_id, accepted_at);
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY NOT NULL,
    participant_id TEXT NOT NULL,
    app_version TEXT NOT NULL,
    device_info TEXT NOT NULL,
    started_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reading_attempts (
    attempt_id TEXT PRIMARY KEY NOT NULL,
    participant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    language TEXT NOT NULL,
    level TEXT NOT NULL,
    audio_path TEXT,
    accuracy REAL NOT NULL,
    wpm REAL NOT NULL,
    ai_status TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reading_participant ON reading_attempts (participant_id, created_at);
  CREATE TABLE IF NOT EXISTS writing_attempts (
    attempt_id TEXT PRIMARY KEY NOT NULL,
    participant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    language TEXT NOT NULL,
    input_method TEXT NOT NULL,
    image_path TEXT,
    original_ocr TEXT,
    corrected_text TEXT NOT NULL,
    ai_status TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_writing_participant ON writing_attempts (participant_id, created_at);
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    permanent INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (entity_type, entity_id)
  );
  `,
];

interface QueueRow {
  id: string;
  entity_type: string;
  entity_id: string;
  participant_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  permanent: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

const toQueueItem = (r: QueueRow): SyncItem => ({
  id: r.id,
  entityType: r.entity_type as SyncEntityType,
  entityId: r.entity_id,
  participantId: r.participant_id,
  status: r.status as SyncItem["status"],
  attempts: r.attempts,
  lastError: r.last_error,
  permanent: r.permanent === 1,
  nextRetryAt: r.next_retry_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const parse = <T,>(rows: { payload: string }[]): T[] => rows.map((r) => JSON.parse(r.payload) as T);

export function createRepository(): Repository {
  let db: SQLite.SQLiteDatabase | null = null;
  const d = () => {
    if (!db) throw new Error("Database not initialised");
    return db;
  };

  return {
    async init() {
      db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      let version = row?.user_version ?? 0;
      while (version < MIGRATIONS.length) {
        await db.withTransactionAsync(async () => {
          await d().execAsync(MIGRATIONS[version]);
        });
        version += 1;
        await db.execAsync(`PRAGMA user_version = ${version}`);
      }
    },

    async getMeta(key) {
      const r = await d().getFirstAsync<{ value: string | null }>("SELECT value FROM meta WHERE key = ?", key);
      return r?.value ?? null;
    },
    async setMeta(key, value) {
      if (value == null) await d().runAsync("DELETE FROM meta WHERE key = ?", key);
      else await d().runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
    },

    async getProfile(participantId) {
      const r = await d().getFirstAsync<{ payload: string; credential: string | null }>(
        "SELECT payload, credential FROM profile WHERE participant_id = ?",
        participantId
      );
      return r ? { profile: JSON.parse(r.payload) as StudentProfile, credential: r.credential } : null;
    },
    async findProfile(identifier) {
      const id = identifier.trim();
      const r = await d().getFirstAsync<{ payload: string; credential: string | null }>(
        "SELECT payload, credential FROM profile WHERE participant_id = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1",
        id,
        id
      );
      return r ? ({ profile: JSON.parse(r.payload), credential: r.credential } as StoredProfile) : null;
    },
    async saveProfile(profile, credential) {
      const existing = await d().getFirstAsync<{ credential: string | null }>(
        "SELECT credential FROM profile WHERE participant_id = ?",
        profile.participantId
      );
      await d().runAsync(
        "INSERT OR REPLACE INTO profile (participant_id, student_id, email, credential, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        profile.participantId,
        profile.studentId,
        profile.email || null,
        credential !== undefined ? credential : existing?.credential ?? null,
        JSON.stringify(profile),
        profile.updatedAt
      );
    },

    async getConsent(participantId) {
      const r = await d().getFirstAsync<{ payload: string }>(
        "SELECT payload FROM consent_records WHERE participant_id = ? ORDER BY accepted_at DESC LIMIT 1",
        participantId
      );
      return r ? (JSON.parse(r.payload) as ConsentRecord) : null;
    },
    async getConsentById(id) {
      const r = await d().getFirstAsync<{ payload: string }>("SELECT payload FROM consent_records WHERE id = ?", id);
      return r ? (JSON.parse(r.payload) as ConsentRecord) : null;
    },
    async saveConsent(c) {
      await d().runAsync(
        "INSERT OR REPLACE INTO consent_records (id, participant_id, consent_version, status, accepted_at, withdrawn_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?)",
        c.id,
        c.participantId,
        c.consentVersion,
        c.status,
        c.acceptedAt,
        c.withdrawnAt ?? null,
        JSON.stringify(c)
      );
    },

    async saveSession(s: SessionRecord) {
      await d().runAsync(
        "INSERT OR REPLACE INTO sessions (session_id, participant_id, app_version, device_info, started_at) VALUES (?, ?, ?, ?, ?)",
        s.sessionId,
        s.participantId,
        s.appVersion,
        s.deviceInfo,
        s.startedAt
      );
    },
    async getSession(sessionId) {
      const r = await d().getFirstAsync<{
        session_id: string;
        participant_id: string;
        app_version: string;
        device_info: string;
        started_at: string;
      }>("SELECT * FROM sessions WHERE session_id = ?", sessionId);
      return r
        ? {
            sessionId: r.session_id,
            participantId: r.participant_id,
            appVersion: r.app_version,
            deviceInfo: r.device_info,
            startedAt: r.started_at,
          }
        : null;
    },

    async listReading(participantId) {
      return parse<ReadingAttempt>(
        await d().getAllAsync<{ payload: string }>(
          "SELECT payload FROM reading_attempts WHERE participant_id = ? ORDER BY created_at DESC",
          participantId
        )
      );
    },
    async getReading(id) {
      const r = await d().getFirstAsync<{ payload: string }>("SELECT payload FROM reading_attempts WHERE attempt_id = ?", id);
      return r ? (JSON.parse(r.payload) as ReadingAttempt) : null;
    },
    async saveReading(a: ReadingAttempt) {
      await d().runAsync(
        `INSERT OR REPLACE INTO reading_attempts
          (attempt_id, participant_id, session_id, language, level, audio_path, accuracy, wpm, ai_status, synced, created_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        a.participantId,
        a.sessionId,
        a.language,
        a.level,
        a.audioUri,
        a.accuracy,
        a.wpm,
        a.aiStatus,
        a.synced ? 1 : 0,
        a.createdAt,
        JSON.stringify(a)
      );
    },

    async listWriting(participantId) {
      return parse<WritingAttempt>(
        await d().getAllAsync<{ payload: string }>(
          "SELECT payload FROM writing_attempts WHERE participant_id = ? ORDER BY created_at DESC",
          participantId
        )
      );
    },
    async getWriting(id) {
      const r = await d().getFirstAsync<{ payload: string }>("SELECT payload FROM writing_attempts WHERE attempt_id = ?", id);
      return r ? (JSON.parse(r.payload) as WritingAttempt) : null;
    },
    async saveWriting(a: WritingAttempt) {
      await d().runAsync(
        `INSERT OR REPLACE INTO writing_attempts
          (attempt_id, participant_id, session_id, language, input_method, image_path, original_ocr, corrected_text, ai_status, synced, created_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        a.participantId,
        a.sessionId,
        a.language,
        a.inputMethod,
        a.imageUri,
        a.originalOcr,
        a.correctedText,
        a.aiStatus,
        a.synced ? 1 : 0,
        a.createdAt,
        JSON.stringify(a)
      );
    },

    async deleteParticipantData(participantId) {
      await d().withTransactionAsync(async () => {
        await d().runAsync("DELETE FROM reading_attempts WHERE participant_id = ?", participantId);
        await d().runAsync("DELETE FROM writing_attempts WHERE participant_id = ?", participantId);
        await d().runAsync(
          "DELETE FROM sync_queue WHERE participant_id = ? AND entity_type IN ('reading', 'writing')",
          participantId
        );
      });
    },

    async listQueue() {
      return (await d().getAllAsync<QueueRow>("SELECT * FROM sync_queue ORDER BY created_at ASC")).map(toQueueItem);
    },
    async getQueueItemFor(entityType, entityId) {
      const r = await d().getFirstAsync<QueueRow>(
        "SELECT * FROM sync_queue WHERE entity_type = ? AND entity_id = ?",
        entityType,
        entityId
      );
      return r ? toQueueItem(r) : null;
    },
    async saveQueueItem(i) {
      await d().runAsync(
        `INSERT OR REPLACE INTO sync_queue
          (id, entity_type, entity_id, participant_id, status, attempts, last_error, permanent, next_retry_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        i.id,
        i.entityType,
        i.entityId,
        i.participantId,
        i.status,
        i.attempts,
        i.lastError,
        i.permanent ? 1 : 0,
        i.nextRetryAt,
        i.createdAt,
        i.updatedAt
      );
    },
  };
}
