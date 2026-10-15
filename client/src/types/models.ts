import type { AlignedWord } from "@/features/reading/analyzer";
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
  transcript: string;
  audioUri: string | null;
  durationSec: number;
  asrConfidence: number;
  asrModelVersion: string;
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
  aiStatus: AiStatus;
  feedback?: AiFeedback;
  synced: boolean;
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
