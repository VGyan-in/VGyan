export interface StudentProfile {
  studentId: string;
  participantId: string;
  name: string;
  kannadaName: string;
  grade: string;
  section: string;
  school: string;
  medium: string;
  nativeLanguage: string;
  ageGroup: string;
  gender: string;
  streakDays: number;
  totalAssessments: number;
}

export interface ConsentRecord {
  consentVersion: string;
  acceptedAt: string;
  signerType: "guardian" | "student";
  signerName: string;
  signerRelation: string;
  language: "en" | "kn" | "both";
  audioConsent: boolean;
  handwritingConsent: boolean;
  researchConsent: boolean;
  status: "active" | "pending" | "withdrawn";
}

export interface ReadingAttempt {
  id: string;
  title: string;
  kannadaTitle: string;
  language: "English" | "Kannada";
  level: "Easy" | "Medium" | "Advanced";
  date: string;
  accuracy: number;
  wpm: number;
  pace: string;
  durationSec: number;
  mistakesCount: number;
  practiceWords: string[];
  aiStatus: "completed" | "synced";
}

export interface WritingAttempt {
  id: string;
  prompt: string;
  kannadaPrompt: string;
  language: "English" | "Kannada";
  date: string;
  score: number; // out of 10
  wordCount: number;
  grammarScore: number;
  vocabularyScore: number;
  spellingScore: number;
  ocrAccuracy: number;
  aiFeedback: string;
}

export interface SyncStatus {
  lastSynced: string;
  pendingRecords: number;
  totalLocalRecords: number;
  audioFilesCount: number;
  audioStorageSizeMb: number;
  imagesCount: number;
  imagesStorageSizeMb: number;
  autoSyncWifi: boolean;
  isSyncing: boolean;
}

export const initialStudentProfile: StudentProfile = {
  studentId: "STU-8842",
  participantId: "VG-2026-8842",
  name: "Aarav Sharma",
  kannadaName: "ಆರವ್ ಶರ್ಮಾ",
  grade: "Grade 5",
  section: "B",
  school: "Govt Model Primary School, Bengaluru",
  medium: "Bilingual (English & Kannada)",
  nativeLanguage: "Kannada",
  ageGroup: "10-11 years",
  gender: "Male",
  streakDays: 5,
  totalAssessments: 18,
};

export const initialConsentState: ConsentRecord = {
  consentVersion: "v1.0",
  acceptedAt: "2026-10-01T10:00:00Z",
  signerType: "guardian",
  signerName: "Ramesh Sharma",
  signerRelation: "Parent / Father",
  language: "both",
  audioConsent: true,
  handwritingConsent: true,
  researchConsent: true,
  status: "active",
};

export const initialSyncStatus: SyncStatus = {
  lastSynced: "Today at 02:45 PM",
  pendingRecords: 0,
  totalLocalRecords: 18,
  audioFilesCount: 12,
  audioStorageSizeMb: 42.6,
  imagesCount: 6,
  imagesStorageSizeMb: 14.2,
  autoSyncWifi: true,
  isSyncing: false,
};

export const mockReadingAttempts: ReadingAttempt[] = [
  {
    id: "RA-101",
    title: "The Clever Crow",
    kannadaTitle: "ಜಾಣ ಕಾಗೆ",
    language: "English",
    level: "Medium",
    date: "Today, 11:30 AM",
    accuracy: 94,
    wpm: 82,
    pace: "Steady",
    durationSec: 48,
    mistakesCount: 3,
    practiceWords: ["thirsty", "pebbles", "pitcher"],
    aiStatus: "synced",
  },
  {
    id: "RA-102",
    title: "ನನ್ನ ಸುಂದರ ಶಾಲೆ (My School)",
    kannadaTitle: "ನನ್ನ ಸುಂದರ ಶಾಲೆ",
    language: "Kannada",
    level: "Easy",
    date: "Yesterday",
    accuracy: 91,
    wpm: 76,
    pace: "Good",
    durationSec: 52,
    mistakesCount: 4,
    practiceWords: ["ಶಿಕ್ಷಕರು", "ಪುಸ್ತಕ", "ಸ್ನೇಹಿತರು"],
    aiStatus: "synced",
  },
  {
    id: "RA-103",
    title: "The Honest Woodcutter",
    kannadaTitle: "ಪ್ರಾಮಾಣಿಕ ಮರಕಡಿಯುವವನು",
    language: "English",
    level: "Medium",
    date: "05 Oct",
    accuracy: 89,
    wpm: 74,
    pace: "Moderate",
    durationSec: 58,
    mistakesCount: 5,
    practiceWords: ["golden", "goddess", "reward"],
    aiStatus: "synced",
  },
  {
    id: "RA-104",
    title: "ಮಳೆ ಮತ್ತು ರೈತ (Rain & Farmer)",
    kannadaTitle: "ಮಳೆ ಮತ್ತು ರೈತ",
    language: "Kannada",
    level: "Medium",
    date: "04 Oct",
    accuracy: 92,
    wpm: 80,
    pace: "Fluent",
    durationSec: 45,
    mistakesCount: 2,
    practiceWords: ["ಬೆಳೆಗಳು", "ಆಕಾಶ", "ಸಮೃದ್ಧಿ"],
    aiStatus: "synced",
  },
];

export const mockWritingAttempts: WritingAttempt[] = [
  {
    id: "WA-201",
    prompt: "Describe your favorite festival and how you celebrate it.",
    kannadaPrompt: "ನಿಮ್ಮ ನೆಚ್ಚಿನ ಹಬ್ಬ ಮತ್ತು ಅದನ್ನು ನೀವು ಹೇಗೆ ಆಚರಿಸುತ್ತೀರಿ ಎಂಬುದನ್ನು ವಿವರಿಸಿ.",
    language: "English",
    date: "Today, 09:15 AM",
    score: 8.8,
    wordCount: 74,
    grammarScore: 88,
    vocabularyScore: 84,
    spellingScore: 92,
    ocrAccuracy: 96,
    aiFeedback: "Strong vocabulary in describing festive foods. Pay slight attention to past-tense subject-verb agreement.",
  },
  {
    id: "WA-202",
    prompt: "ನಮ್ಮ ಪರಿಸರವನ್ನು ಹೇಗೆ ಸಂರಕ್ಷಿಸಬಹುದು? (How to protect nature?)",
    kannadaPrompt: "ನಮ್ಮ ಪರಿಸರವನ್ನು ಹೇಗೆ ಸಂರಕ್ಷಿಸಬಹುದು?",
    language: "Kannada",
    date: "05 Oct",
    score: 8.4,
    wordCount: 62,
    grammarScore: 86,
    vocabularyScore: 82,
    spellingScore: 90,
    ocrAccuracy: 94,
    aiFeedback: "ಉತ್ತಮ ಬರವಣಿಗೆ ಶೈಲಿ! ವಾಕ್ಯ ಸಂಯೋಜನೆ ಮತ್ತು ಒತ್ತಕ್ಷರಗಳ ಬಳಕೆ ಸ್ಪಷ್ಟವಾಗಿದೆ.",
  },
];

export const mockPracticeWordsList = [
  { word: "Thirsty", kannada: "ಬಾಯಾರಿದ", phonetics: "/ˈθɜːr.sti/", difficulty: "Medium", attempts: 3 },
  { word: "Pebbles", kannada: "ಸಣ್ಣ ಕಲ್ಲುಗಳು", phonetics: "/ˈpeb.əlz/", difficulty: "Easy", attempts: 2 },
  { word: "Pitcher", kannada: "ಕೂಜಾ / ಮಡಕೆ", phonetics: "/ˈpɪtʃ.ər/", difficulty: "Hard", attempts: 4 },
  { word: "ಶಿಕ್ಷಕರು", kannada: "Teachers", phonetics: "Shikshakaru", difficulty: "Medium", attempts: 3 },
  { word: "ಸಮೃದ್ಧಿ", kannada: "Prosperity", phonetics: "Samruddhi", difficulty: "Hard", attempts: 5 },
];
