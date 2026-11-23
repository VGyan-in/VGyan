import type { AlignedWord } from "@/features/reading/analyzer";
import type { AsrWord, FluencyMetrics } from "@/features/reading/fluency";
import type { AiFeedback, WritingAssessment } from "@/features/feedback/ai";
import type { AssessmentLanguage, Level } from "@/constants/content";

export interface StudentProfile {
  studentId: string;
  participantId: string;
  name: string;
  email: string;
  grade: string;
  section: string;
  school: string;
  schoolType: string;
  medium: string;
  nativeLanguage: string;
  otherLanguages: string;
  ageGroup: string;
  gender: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  participantId: string;
  consentVersion: string;
  acceptedAt: string;
  withdrawnAt?: string | null;
  signerType: "guardian" | "student";
  signerName: string;
  signerRelation: string;
  language: "en" | "kn" | "both";
  audioConsent: boolean;
  handwritingConsent: boolean;
  researchConsent: boolean;
  status: "active" | "withdrawn";
}

export interface SessionRecord {
  sessionId: string;
  participantId: string;
  appVersion: string;
  deviceInfo: string;
  startedAt: string;
}

export type AiStatus = "pending" | "completed" | "failed";

export interface ReadingAttempt {
  id: string;
  participantId: string;
  sessionId: string;
  passageId: string;
  title: string;
  kannadaTitle: string;
  language: AssessmentLanguage;
  level: Level;
  createdAt: string;
  referenceText: string;
  /** "pending" when no speech model was available: audio is kept, metrics are not yet computed. */
  asrStatus: "completed" | "pending";
  transcript: string;
  audioUri: string | null;
  durationSec: number;
  /** Mean Vosk word confidence; null when nothing was recognised. */
  asrConfidence: number | null;
  asrModelVersion: string;
  /** Per-word timings and confidences exactly as returned by the recogniser. */
  asrWords?: AsrWord[];
  asrMs?: number | null;
  analysisVersion?: string;
  accuracy: number;
  wpm: number;
  wcpm: number;
  pace: string;
  mistakesCount: number;
  substitutions: number;
  omissions: number;
  insertions: number;
  practiceWords: string[];
  words: AlignedWord[];
  /** Pause/repetition measures; present only when ASR returned word timestamps. */
  fluency?: FluencyMetrics;
  aiStatus: AiStatus;
  feedback?: AiFeedback;
  synced: boolean;
  /** Set once the server confirmed it holds this exact audio file (checked before any local purge). */
  serverFileMd5?: string | null;
}

export interface WritingAttempt {
  id: string;
  participantId: string;
  sessionId: string;
  promptId: string;
  prompt: string;
  kannadaPrompt: string;
  language: AssessmentLanguage;
  createdAt: string;
  inputMethod: "typed" | "camera" | "gallery";
  imageUri: string | null;
  /** Raw OCR output, never overwritten by the student's correction. */
  originalOcr: string | null;
  ocrConfidence: number | null;
  /** Server-side OCR record, so the server can confirm originalOcr is what the engine returned. */
  ocrId?: string | null;
  ocrEngineVersion?: string | null;
  correctedText: string;
  wordCount: number;
  sentenceCount: number;
  score: number;
  grammarScore: number;
  vocabularyScore: number;
  spellingScore: number;
  aiStatus: AiStatus;
  assessment?: WritingAssessment;
  synced: boolean;
  serverFileMd5?: string | null;
}

export type SyncEntityType = "reading" | "writing" | "consent";
export type SyncStatus = "pending" | "uploading" | "synced" | "failed";

export interface SyncItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  participantId: string;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  /** Permanent failures (4xx validation) are not retried automatically. */
  permanent: boolean;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}
