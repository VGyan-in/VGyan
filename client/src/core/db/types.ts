import type {
  ConsentRecord,
  ReadingAttempt,
  SessionRecord,
  StudentProfile,
  SyncEntityType,
  SyncItem,
  WritingAttempt,
} from "@/types/models";

export interface StoredProfile {
  profile: StudentProfile;
  /** Salted password hash for signing in on this device. */
  credential: string | null;
}

/**
 * Persistence boundary. SQLite on Android/iOS, localStorage on web (dev only).
 * Everything the app records goes through here, so the device stays the
 * source of truth until the server confirms receipt.
 */
export interface Repository {
  init(): Promise<void>;

  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string | null): Promise<void>;

  getProfile(participantId: string): Promise<StoredProfile | null>;
  /** Looks up by participant ID or email (case-insensitive). */
  findProfile(identifier: string): Promise<StoredProfile | null>;
  saveProfile(profile: StudentProfile, credential?: string | null): Promise<void>;

  getConsent(participantId: string): Promise<ConsentRecord | null>;
  getConsentById(id: string): Promise<ConsentRecord | null>;
  saveConsent(consent: ConsentRecord): Promise<void>;

  saveSession(session: SessionRecord): Promise<void>;
  getSession(sessionId: string): Promise<SessionRecord | null>;

  listReading(participantId: string): Promise<ReadingAttempt[]>;
  getReading(id: string): Promise<ReadingAttempt | null>;
  saveReading(attempt: ReadingAttempt): Promise<void>;

  listWriting(participantId: string): Promise<WritingAttempt[]>;
  getWriting(id: string): Promise<WritingAttempt | null>;
  saveWriting(attempt: WritingAttempt): Promise<void>;

  /** Removes a participant's attempts and queue items from this device. */
  deleteParticipantData(participantId: string): Promise<void>;

  listQueue(): Promise<SyncItem[]>;
  getQueueItemFor(entityType: SyncEntityType, entityId: string): Promise<SyncItem | null>;
  saveQueueItem(item: SyncItem): Promise<void>;
}
