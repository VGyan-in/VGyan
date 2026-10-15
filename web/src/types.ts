export type Language = 'English' | 'Kannada';

export interface Teacher {
  id: string;
  name: string;
  email: string;
  school: string;
  assignedClasses: ClassGroup[];
}

export interface ClassGroup {
  id: string;
  name: string;
  grade: number;
  section: string;
  studentCount: number;
}

export interface WordError {
  word: string;
  type: 'substitution' | 'omission' | 'insertion' | 'repetition';
  spoken?: string;
  timestamp?: number;
}

export interface ReadingAssessment {
  id: string;
  participantId: string;
  studentId: string;
  studentName: string;
  date: string;
  passageTitle: string;
  language: Language;
  level: 'Easy' | 'Medium' | 'Advanced';
  accuracy: number; // percentage
  wpm: number;
  durationSeconds: number;
  audioDurationSeconds: number;
  errors: WordError[];
  aiQualitativeFeedback: string;
}

export interface WritingAssessment {
  id: string;
  participantId: string;
  studentId: string;
  studentName: string;
  date: string;
  promptTitle: string;
  language: Language;
  mode: 'typed' | 'handwritten_photo';
  rawOcrText?: string;
  studentCorrectedText: string;
  imageUrl?: string;
  wordCount: number;
  spellingErrorsCount: number;
  grammarScore: number; // 0 - 100
  aiFeedback: string;
}

export interface Student {
  studentId: string;
  participantId: string; // Anonymous research identifier
  name: string;
  classId: string;
  grade: number;
  section: string;
  age: number;
  nativeLanguage: 'Kannada' | 'Tamil' | 'Telugu' | 'Hindi' | 'Urdu';
  consentStatus: 'active' | 'withdrawn' | 'pending';
  lastAssessmentDate: string;
  overallReadingAccuracy: number;
  averageWpm: number;
  writingScore: number;
  isAtRisk: boolean; // < 75% accuracy
  atRiskReason?: string;
  recentReadingAttempts: ReadingAssessment[];
  recentWritingAttempts: WritingAssessment[];
  radarSkills: {
    fluency: number;
    pronunciation: number;
    vocabulary: number;
    sentenceStructure: number;
    consistency: number;
  };
}

export interface MissedWord {
  word: string;
  language: Language;
  frequency: number;
  primaryError: 'substitution' | 'omission';
  commonSubstitutions: string[];
  affectedStudentsCount: number;
}

export interface TeacherComment {
  id: string;
  studentId: string;
  studentName: string;
  author: string;
  text: string;
  category: 'Intervention' | 'Praise' | 'Parent Note' | 'General';
  timestamp: string;
}
