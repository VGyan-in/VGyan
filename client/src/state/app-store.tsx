import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Lang } from "@/constants/content";
import {
  ConsentRecord,
  ReadingAttempt,
  StudentProfile,
  SyncStatus,
  WritingAttempt,
  initialStudentProfile,
  initialSyncStatus,
  mockReadingAttempts,
  mockWritingAttempts,
} from "@/constants/mock-data";
import { formatTime } from "@/utils/format";

/** In-progress writing attempt, handed between the writing flow screens. */
export interface WritingDraft {
  promptId: string;
  inputMethod: "typed" | "camera" | "gallery";
  imageUri: string | null;
  originalOcr: string | null;
  ocrConfidence: number | null;
  text: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  participantId: string;
}

interface AppState {
  lang: Lang;
  toggleLang: () => void;

  isAuthenticated: boolean;
  profile: StudentProfile;
  login: (identifier: string) => void;
  register: (input: RegisterInput) => void;
  logout: () => void;

  consent: ConsentRecord | null;
  hasActiveConsent: boolean;
  acceptConsent: (record: ConsentRecord) => void;
  withdrawConsent: () => void;

  readingAttempts: ReadingAttempt[];
  writingAttempts: WritingAttempt[];
  addReadingAttempt: (a: ReadingAttempt) => void;
  updateReadingAttempt: (id: string, patch: Partial<ReadingAttempt>) => void;
  addWritingAttempt: (a: WritingAttempt) => void;
  updateWritingAttempt: (id: string, patch: Partial<WritingAttempt>) => void;

  writingDraft: WritingDraft | null;
  setWritingDraft: (d: WritingDraft | null) => void;

  sync: SyncStatus;
  pendingCount: number;
  setAutoSyncWifi: (v: boolean) => void;
  /** STUB: stands in for the sync worker until the SQLite queue and /sync endpoints exist. */
  syncNow: () => Promise<number>;
}

const AppContext = createContext<AppState | null>(null);

function generateParticipantId() {
  return `VG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * App-wide state. Held in memory for now; the repositories over SQLite
 * (see README §8) will back these same actions so screens don't change.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<StudentProfile>(initialStudentProfile);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [readingAttempts, setReadingAttempts] = useState<ReadingAttempt[]>(mockReadingAttempts);
  const [writingAttempts, setWritingAttempts] = useState<WritingAttempt[]>(mockWritingAttempts);
  const [writingDraft, setWritingDraft] = useState<WritingDraft | null>(null);
  const [sync, setSync] = useState<SyncStatus>(initialSyncStatus);

  const toggleLang = useCallback(() => setLang((l) => (l === "en" ? "kn" : "en")), []);

  const login = useCallback((identifier: string) => {
    const id = identifier.trim().toUpperCase();
    if (/^VG-\d{4}-\d+$/.test(id)) setProfile((p) => ({ ...p, participantId: id }));
    setIsAuthenticated(true);
  }, []);

  const register = useCallback((input: RegisterInput) => {
    setProfile({
      ...initialStudentProfile,
      studentId: `STU-${Math.floor(1000 + Math.random() * 9000)}`,
      participantId: input.participantId.trim().toUpperCase() || generateParticipantId(),
      name: input.fullName.trim() || initialStudentProfile.name,
      kannadaName: input.fullName.trim() || initialStudentProfile.kannadaName,
      streakDays: 0,
      totalAssessments: 0,
    });
    setReadingAttempts([]);
    setWritingAttempts([]);
    setSync({ ...initialSyncStatus, lastSynced: "Never", totalLocalRecords: 0, audioFilesCount: 0, audioStorageSizeMb: 0, imagesCount: 0, imagesStorageSizeMb: 0 });
    setConsent(null);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setWritingDraft(null);
  }, []);

  const acceptConsent = useCallback((record: ConsentRecord) => setConsent(record), []);
  const withdrawConsent = useCallback(
    () => setConsent((c) => (c ? { ...c, status: "withdrawn" } : c)),
    []
  );

  const addReadingAttempt = useCallback((a: ReadingAttempt) => {
    setReadingAttempts((list) => [a, ...list]);
    setProfile((p) => ({ ...p, totalAssessments: p.totalAssessments + 1 }));
  }, []);
  const updateReadingAttempt = useCallback((id: string, patch: Partial<ReadingAttempt>) => {
    setReadingAttempts((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);
  const addWritingAttempt = useCallback((a: WritingAttempt) => {
    setWritingAttempts((list) => [a, ...list]);
    setProfile((p) => ({ ...p, totalAssessments: p.totalAssessments + 1 }));
  }, []);
  const updateWritingAttempt = useCallback((id: string, patch: Partial<WritingAttempt>) => {
    setWritingAttempts((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const pendingCount = useMemo(
    () =>
      readingAttempts.filter((a) => a.synced === false).length +
      writingAttempts.filter((a) => a.synced === false).length,
    [readingAttempts, writingAttempts]
  );

  const setAutoSyncWifi = useCallback(
    (v: boolean) => setSync((s) => ({ ...s, autoSyncWifi: v })),
    []
  );

  const syncNow = useCallback(async () => {
    const pendingReading = readingAttempts.filter((a) => a.synced === false);
    const pendingWriting = writingAttempts.filter((a) => a.synced === false);
    const count = pendingReading.length + pendingWriting.length;
    setSync((s) => ({ ...s, isSyncing: true }));
    await new Promise((r) => setTimeout(r, 1200));
    setReadingAttempts((list) => list.map((a) => (a.synced === false ? { ...a, synced: true } : a)));
    setWritingAttempts((list) => list.map((a) => (a.synced === false ? { ...a, synced: true } : a)));
    setSync((s) => ({
      ...s,
      isSyncing: false,
      lastSynced: `Today at ${formatTime(new Date())}`,
      pendingRecords: 0,
      totalLocalRecords: s.totalLocalRecords + count,
      audioFilesCount: s.audioFilesCount + pendingReading.filter((a) => a.audioUri).length,
      imagesCount: s.imagesCount + pendingWriting.filter((a) => a.imageUri).length,
    }));
    return count;
  }, [readingAttempts, writingAttempts]);

  const value: AppState = {
    lang,
    toggleLang,
    isAuthenticated,
    profile,
    login,
    register,
    logout,
    consent,
    hasActiveConsent: consent?.status === "active",
    acceptConsent,
    withdrawConsent,
    readingAttempts,
    writingAttempts,
    addReadingAttempt,
    updateReadingAttempt,
    addWritingAttempt,
    updateWritingAttempt,
    writingDraft,
    setWritingDraft,
    sync: { ...sync, pendingRecords: pendingCount },
    pendingCount,
    setAutoSyncWifi,
    syncNow,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
