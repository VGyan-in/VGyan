// Shapes returned by the VGyan backend (backend/app/api/teacher.py).

export type Language = 'English' | 'Kannada';
export type Role = 'teacher' | 'researcher' | 'admin';

export interface ClassGroup {
  id: string;
  name: string;
  grade: number;
  section: string;
  joinCode: string;
  school: string;
  studentCount: number;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  role: Role;
  school: string;
  assignedClasses: ClassGroup[];
}

export type WordStatus = 'correct' | 'substitution' | 'omission' | 'insertion';

export interface AlignedWord {
  status: WordStatus;
  ref?: string;
  hyp?: string;
}

export interface AiFeedback {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  suggestions?: string[];
  practiceWords?: string[];
  misspelled?: string[];
  correctedText?: string;
  modelVersion?: string;
  promptVersion?: string;
}

export interface ReadingAssessment {
  id: string;
  participantId: string;
  studentId: string;
  studentName: string;
  date: string;
  passageId: string;
  passageTitle: string;
  language: Language;
  level: 'Easy' | 'Medium' | 'Advanced';
  /** "pending": recorded without a speech model; metrics are null until the phone transcribes it. */
  asrStatus: 'completed' | 'pending';
  accuracy: number | null;
  wpm: number | null;
  wcpm: number | null;
  pace: string;
  durationSeconds: number;
  substitutions: number | null;
  omissions: number | null;
  insertions: number | null;
  referenceText: string;
  transcript: string;
  words: AlignedWord[];
  practiceWords: string[];
  fluency: Record<string, unknown> | null;
  asrModelVersion: string;
  asrConfidence: number | null;
  metricsVerified: boolean | null;
  hasAudio: boolean;
  aiStatus: string;
  aiFeedback: AiFeedback | null;
  aiModelVersion: string | null;
  aiPromptVersion: string | null;
}

export interface WritingAssessment {
  id: string;
  participantId: string;
  studentId: string;
  studentName: string;
  date: string;
  promptId: string;
  promptTitle: string;
  language: Language;
  inputMethod: 'typed' | 'camera' | 'gallery';
  rawOcrText: string | null;
  ocrConfidence: number | null;
  ocrEngineVersion: string | null;
  ocrMatchesServer: boolean | null;
  studentCorrectedText: string;
  hasImage: boolean;
  wordCount: number;
  sentenceCount: number;
  spellingErrorsCount: number;
  score: number | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  spellingScore: number | null;
  aiStatus: string;
  aiFeedback: AiFeedback | null;
  aiModelVersion: string | null;
  aiPromptVersion: string | null;
}

export interface StudentProfileInfo {
  grade?: string;
  section?: string;
  school?: string;
  schoolType?: string;
  medium?: string;
  nativeLanguage?: string;
  otherLanguages?: string;
  ageGroup?: string;
  gender?: string;
}

export interface Student {
  studentId: string;
  participantId: string;
  name: string;
  classId: string | null;
  className: string | null;
  profile: StudentProfileInfo;
  consentStatus: 'active' | 'withdrawn' | 'pending';
  consentVersion: string | null;
  consentCurrent: boolean;
  lastAssessmentDate: string | null;
  readingCount: number;
  pendingTranscriptions: number;
  writingCount: number;
  overallReadingAccuracy: number | null;
  averageWpm: number | null;
  /** Average AI writing score, 0-10. */
  writingScore: number | null;
  isAtRisk: boolean;
  atRiskReason: string | null;
  recentReadingAttempts: ReadingAssessment[];
  recentWritingAttempts: WritingAssessment[];
}

export interface MissedWord {
  word: string;
  language: Language;
  frequency: number;
  primaryError: 'substitution' | 'omission';
  commonSubstitutions: string[];
  affectedStudentsCount: number;
}

export type CommentCategory = 'Intervention' | 'Praise' | 'Parent Note' | 'General';

export interface TeacherComment {
  id: string;
  studentId: string;
  studentName: string;
  author: string;
  text: string;
  category: CommentCategory;
  timestamp: string;
}

export interface Analytics {
  students: number;
  weekly: {
    week: string;
    readingCount: number;
    writingCount: number;
    avgAccuracy: number | null;
    avgWpm: number | null;
    avgWritingScore: number | null;
  }[];
  byLanguageLevel: {
    language: Language;
    level: string;
    attempts: number;
    avgAccuracy: number | null;
    avgWpm: number | null;
    avgSubstitutions: number | null;
    avgOmissions: number | null;
    avgInsertions: number | null;
  }[];
  completion: {
    readingAny?: number;
    writingAny?: number;
    both?: number;
    englishReading?: number;
    kannadaReading?: number;
    none?: number;
  };
  unverifiedMetrics?: number;
  pendingTranscriptions?: number;
}

export interface Passage {
  id: string;
  kind: 'reading' | 'writing';
  language: Language;
  level: 'Easy' | 'Medium' | 'Advanced' | null;
  title: string;
  kannadaTitle: string;
  text: string;
  kannadaText: string;
  minWords: number | null;
  hint: string;
  kannadaHint: string;
  version: number;
  isActive: boolean;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  passageId: string;
  classId: string;
  dueAt: string | null;
  createdAt: string;
}

export interface ResearchSummary {
  consentedParticipants: number;
  readingAttempts: number;
  writingAttempts: number;
  readingWithAudio: number;
  readingMetricsUnverified: number;
  readingPendingTranscription: number;
  writingFromImage: number;
  byLanguage: Record<Language, { reading: number; writing: number }>;
}
