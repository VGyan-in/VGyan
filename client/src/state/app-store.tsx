import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Device from "expo-device";
import * as Network from "expo-network";
import type { Lang } from "@/constants/content";
import { config, isServerConfigured } from "@/core/config";
import { hashPassword, newId, verifyPassword } from "@/core/auth/credentials";
import { clearAuthToken, remoteLogin, remoteRegister, syncProfile } from "@/core/auth/remote";
import { createRepository } from "@/core/db/repository";
import type { Repository } from "@/core/db/types";
import { deleteMedia, localMd5, persistMedia } from "@/core/storage/files";
import { enqueue, processQueue, resetInterrupted, retryItem } from "@/core/sync/queue";
import { createUploader } from "@/core/sync/uploader";
import { isRetryableAiError, requestReadingFeedback, requestWritingAssessment } from "@/features/feedback/ai";
import { getWritingPrompt } from "@/constants/content";
import { transcribeFile } from "@/features/reading/asr";
import { getModelState } from "@/features/reading/models";
import { analyzeReading, ANALYSIS_VERSION } from "@/features/reading/analyzer";
import { computeFluency } from "@/features/reading/fluency";
import { acquireSyncLock, releaseSyncLock } from "@/core/sync/lock";

import type {
  ConsentRecord,
  ReadingAttempt,
  SessionRecord,
  StudentProfile,
  SyncEntityType,
  SyncItem,
  WritingAttempt,
} from "@/types/models";

/** In-progress writing attempt, handed between the writing flow screens. */
export interface WritingDraft {
  promptId: string;
  inputMethod: "typed" | "camera" | "gallery";
  imageUri: string | null;
  originalOcr: string | null;
  ocrConfidence: number | null;
  ocrId?: string | null;
  ocrEngineVersion?: string | null;
  text: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  participantId: string;
  password: string;
  /** Class join code from the teacher; links the student to the teacher's dashboard. */
  classCode?: string;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ConsentInput = Omit<ConsentRecord, "id" | "participantId" | "consentVersion" | "acceptedAt" | "status" | "withdrawnAt">;

type NewReading = Omit<ReadingAttempt, "participantId" | "sessionId" | "synced" | "createdAt">;
type NewWriting = Omit<WritingAttempt, "participantId" | "sessionId" | "synced" | "createdAt">;

export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastMessage: string | null;
  autoSync: boolean;
  isOnline: boolean;
  serverConfigured: boolean;
}

interface AppStateValue {
  ready: boolean;
  lang: Lang;
  toggleLang: () => void;

  isAuthenticated: boolean;
  profile: StudentProfile | null;
  profileComplete: boolean;
  register: (input: RegisterInput) => Promise<ActionResult>;
  login: (identifier: string, password: string) => Promise<ActionResult>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<StudentProfile>) => Promise<void>;

  consent: ConsentRecord | null;
  hasActiveConsent: boolean;
  acceptConsent: (input: ConsentInput) => Promise<void>;
  withdrawConsent: () => Promise<void>;
  deleteLocalData: () => Promise<void>;

  readingAttempts: ReadingAttempt[];
  writingAttempts: WritingAttempt[];
  saveNewReading: (a: NewReading) => Promise<ReadingAttempt>;
  updateReadingAttempt: (id: string, patch: Partial<ReadingAttempt>) => Promise<void>;
  saveNewWriting: (a: NewWriting) => Promise<WritingAttempt>;
  updateWritingAttempt: (id: string, patch: Partial<WritingAttempt>) => Promise<void>;
  /** Requests AI feedback for a saved attempt; false if it must wait (offline etc.). */
  requestFeedbackFor: (id: string) => Promise<boolean>;
  requestWritingAssessmentFor: (id: string) => Promise<boolean>;

  writingDraft: WritingDraft | null;
  setWritingDraft: (d: WritingDraft | null) => void;

  sync: SyncState;
  queue: SyncItem[];
  pendingCount: number;
  failedCount: number;
  setAutoSync: (v: boolean) => Promise<void>;
  syncNow: () => Promise<{ synced: number; failed: number; skipped: number }>;
  retrySyncItem: (item: SyncItem) => Promise<void>;
}

const AppContext = createContext<AppStateValue | null>(null);

const META = {
  lang: "lang",
  participant: "session.participant",
  lastSync: "sync.last",
  autoSync: "sync.auto",
};

const SYNC_INTERVAL_MS = 3 * 60_000;

function generateParticipantId() {
  return `VG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function deviceInfo() {
  return [Device.manufacturer, Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(" ") || "unknown";
}

/** Auto-sync runs on Wi-Fi or wired connections (browsers report UNKNOWN), not on mobile data. */
function isUnmeteredConnection(state: Network.NetworkState) {
  return (
    !!state.isConnected &&
    state.isInternetReachable !== false &&
    state.type !== Network.NetworkStateType.CELLULAR
  );
}

/**
 * App-wide state over the on-device repository. Every change is written to
 * storage first, then reflected in memory; the sync queue uploads in the background.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repo] = useState<Repository>(() => createRepository());
  const uploader = useMemo(() => createUploader(repo), [repo]);

  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [readingAttempts, setReadingAttempts] = useState<ReadingAttempt[]>([]);
  const [writingAttempts, setWritingAttempts] = useState<WritingAttempt[]>([]);
  const [writingDraft, setWritingDraft] = useState<WritingDraft | null>(null);
  const [queue, setQueue] = useState<SyncItem[]>([]);
  const [sync, setSync] = useState<SyncState>({
    isSyncing: false,
    lastSyncedAt: null,
    lastMessage: null,
    autoSync: true,
    isOnline: true,
    serverConfigured: isServerConfigured(),
  });

  const syncRunning = useRef(false);
  const autoSyncRef = useRef(true);
  const networkRef = useRef<Network.NetworkState | null>(null);

  const refreshQueue = useCallback(async () => setQueue(await repo.listQueue()), [repo]);

  const loadParticipant = useCallback(
    async (participantId: string) => {
      const stored = await repo.getProfile(participantId);
      if (!stored) return false;
      const session: SessionRecord = {
        sessionId: newId(),
        participantId,
        appVersion: config.appVersion,
        deviceInfo: deviceInfo(),
        startedAt: new Date().toISOString(),
      };
      await repo.saveSession(session);
      const [c, r, w] = await Promise.all([
        repo.getConsent(participantId),
        repo.listReading(participantId),
        repo.listWriting(participantId),
      ]);
      setProfile(stored.profile);
      setSessionId(session.sessionId);
      setConsent(c);
      setReadingAttempts(r);
      setWritingAttempts(w);
      return true;
    },
    [repo]
  );

  // Boot: open the database, restore language and the signed-in student.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await repo.init();
        await resetInterrupted(repo);
        const [savedLang, pid, lastSync, auto] = await Promise.all([
          repo.getMeta(META.lang),
          repo.getMeta(META.participant),
          repo.getMeta(META.lastSync),
          repo.getMeta(META.autoSync),
        ]);
        if (cancelled) return;
        if (savedLang === "en" || savedLang === "kn") setLang(savedLang);
        autoSyncRef.current = auto !== "false";
        setSync((s) => ({ ...s, lastSyncedAt: lastSync, autoSync: autoSyncRef.current }));
        if (pid && !(await loadParticipant(pid))) await repo.setMeta(META.participant, null);
        await refreshQueue();
      } catch (e) {
        console.warn("storage init failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, loadParticipant, refreshQueue]);

  const toggleLang = useCallback(() => {
    setLang((l) => {
      const next = l === "en" ? "kn" : "en";
      void repo.setMeta(META.lang, next);
      return next;
    });
  }, [repo]);

  // ---------- Sync worker ----------

  const readingFeedback = useCallback(
    async (id: string): Promise<boolean> => {
      const a = await repo.getReading(id);
      if (!a || a.asrStatus === "pending") return false;
      try {
        const feedback = await requestReadingFeedback(
          { ...a, attemptId: a.id, level: a.level, referenceText: a.referenceText, transcript: a.transcript },
          a.language
        );
        const next: ReadingAttempt = { ...a, feedback, aiStatus: "completed", synced: false };
        await repo.saveReading(next);
        await enqueue(repo, "reading", a.id, a.participantId, newId);
        setReadingAttempts((list) => list.map((x) => (x.id === a.id ? next : x)));
        return true;
      } catch (e) {
        const status = isRetryableAiError(e) ? "pending" : "failed";
        if (a.aiStatus !== status) {
          const next: ReadingAttempt = { ...a, aiStatus: status };
          await repo.saveReading(next);
          setReadingAttempts((list) => list.map((x) => (x.id === a.id ? next : x)));
        }
        return false;
      }
    },
    [repo]
  );

  const writingFeedback = useCallback(
    async (id: string): Promise<boolean> => {
      const a = await repo.getWriting(id);
      if (!a) return false;
      const prompt = getWritingPrompt(a.promptId);
      try {
        const assessment = await requestWritingAssessment({
          attemptId: a.id,
          text: a.correctedText,
          language: a.language,
          prompt: a.prompt,
          minWords: prompt?.minWords ?? 40,
          grade: profile?.grade ?? "",
        });
        const next: WritingAttempt = {
          ...a,
          assessment,
          aiStatus: "completed",
          score: assessment.score,
          grammarScore: assessment.grammarScore,
          vocabularyScore: assessment.vocabularyScore,
          spellingScore: assessment.spellingScore,
          synced: false,
        };
        await repo.saveWriting(next);
        await enqueue(repo, "writing", a.id, a.participantId, newId);
        setWritingAttempts((list) => list.map((x) => (x.id === a.id ? next : x)));
        return true;
      } catch (e) {
        const status = isRetryableAiError(e) ? "pending" : "failed";
        if (a.aiStatus !== status) {
          const next: WritingAttempt = { ...a, aiStatus: status };
          await repo.saveWriting(next);
          setWritingAttempts((list) => list.map((x) => (x.id === a.id ? next : x)));
        }
        return false;
      }
    },
    [repo, profile]
  );

  /** Recordings saved while no speech model was installed are transcribed once one is. */
  const processPendingTranscriptions = useCallback(async () => {
    if (!profile) return;
    for (const a of await repo.listReading(profile.participantId)) {
      if (a.asrStatus !== "pending" || !a.audioUri || getModelState(a.language).status !== "ready") continue;
      try {
        const asr = await transcribeFile(a.audioUri, a.language);
        const durationMs = a.durationSec * 1000;
        const an = analyzeReading(a.referenceText, asr.transcript, durationMs, a.language);
        const next: ReadingAttempt = {
          ...a,
          asrStatus: "completed",
          transcript: asr.transcript,
          asrConfidence: asr.confidence,
          asrModelVersion: asr.modelVersion,
          asrWords: asr.words,
          asrMs: asr.asrMs,
          analysisVersion: ANALYSIS_VERSION,
          accuracy: an.accuracy,
          wpm: an.wpm,
          wcpm: an.wcpm,
          pace: an.pace,
          mistakesCount: an.mistakes,
          substitutions: an.substitutions,
          omissions: an.omissions,
          insertions: an.insertions,
          practiceWords: an.practiceWords,
          words: an.words,
          fluency: asr.words.length > 0 ? computeFluency(asr.words) ?? undefined : undefined,
          synced: false,
        };
        await repo.saveReading(next);
        await enqueue(repo, "reading", a.id, a.participantId, newId);
        setReadingAttempts((list) => list.map((x) => (x.id === a.id ? next : x)));
      } catch (e) {
        console.warn("pending transcription failed", e instanceof Error ? e.message : e);
      }
    }
  }, [repo, profile]);

  const retryPendingFeedback = useCallback(async () => {
    if (!profile || !isServerConfigured()) return;
    for (const a of await repo.listReading(profile.participantId)) {
      if (a.asrStatus !== "pending" && a.aiStatus !== "completed") await readingFeedback(a.id);
    }
    for (const a of await repo.listWriting(profile.participantId)) {
      if (a.aiStatus !== "completed") await writingFeedback(a.id);
    }
  }, [repo, profile, readingFeedback, writingFeedback]);

  const markSynced = useCallback(
    async (item: SyncItem) => {
      if (item.entityType === "reading") {
        const a = await repo.getReading(item.entityId);
        if (!a) return;
        let audioUri = a.audioUri;
        if (config.purgeMediaAfterSync && isServerConfigured() && a.serverFileMd5 && localMd5(audioUri) === a.serverFileMd5) {
          deleteMedia(audioUri);
          audioUri = null;
        }
        const next = { ...a, synced: true, audioUri };
        await repo.saveReading(next);
        setReadingAttempts((list) => list.map((x) => (x.id === a.id ? next : x)));
      } else if (item.entityType === "writing") {
        const a = await repo.getWriting(item.entityId);
        if (!a) return;
        let imageUri = a.imageUri;
        if (config.purgeMediaAfterSync && isServerConfigured() && a.serverFileMd5 && localMd5(imageUri) === a.serverFileMd5) {
          deleteMedia(imageUri);
          imageUri = null;
        }
        const next = { ...a, synced: true, imageUri };
        await repo.saveWriting(next);
        setWritingAttempts((list) => list.map((x) => (x.id === a.id ? next : x)));
      }
    },
    [repo]
  );

  const runSync = useCallback(async () => {
    if (syncRunning.current) return { synced: 0, failed: 0, skipped: 0 };
    syncRunning.current = true;
    // The background task may be uploading too; one runner at a time.
    if (!(await acquireSyncLock(repo, "foreground"))) {
      syncRunning.current = false;
      return { synced: 0, failed: 0, skipped: 0 };
    }
    setSync((s) => ({ ...s, isSyncing: true }));
    try {
      await processPendingTranscriptions();
      if (profile) await syncProfile(repo, profile).catch(() => {});
      await retryPendingFeedback();
      const result = await processQueue(repo, uploader, { maxRetries: config.syncMaxRetries });
      for (const item of result.synced) await markSynced(item);
      const ts = new Date().toISOString();
      if (result.synced.length > 0) await repo.setMeta(META.lastSync, ts);
      setSync((s) => ({
        ...s,
        isSyncing: false,
        lastSyncedAt: result.synced.length > 0 ? ts : s.lastSyncedAt,
        serverConfigured: isServerConfigured(),
        lastMessage:
          result.skipped > 0 && result.synced.length === 0
            ? "server-not-configured"
            : result.failed > 0
            ? "some-failed"
            : null,
      }));
      await refreshQueue();
      return { synced: result.synced.length, failed: result.failed, skipped: result.skipped };
    } catch (e) {
      console.warn("sync run failed", e);
      setSync((s) => ({ ...s, isSyncing: false, lastMessage: "some-failed" }));
      return { synced: 0, failed: 0, skipped: 0 };
    } finally {
      await releaseSyncLock(repo, "foreground").catch(() => {});
      syncRunning.current = false;
    }
  }, [repo, uploader, processPendingTranscriptions, retryPendingFeedback, markSynced, refreshQueue, profile]);

  const runSyncRef = useRef(runSync);
  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  const autoSyncIfAllowed = useCallback(() => {
    const net = networkRef.current;
    if (!autoSyncRef.current) return;
    if (net && !isUnmeteredConnection(net)) return;
    void runSyncRef.current();
  }, []);

  // Triggers: connectivity regained, app returns to foreground, periodic timer.
  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    Network.getNetworkStateAsync()
      .then((state) => {
        if (!mounted) return;
        networkRef.current = state;
        setSync((s) => ({ ...s, isOnline: !!state.isConnected }));
        autoSyncIfAllowed();
      })
      .catch(() => {});
    const netSub = Network.addNetworkStateListener((state) => {
      const wasOnline = networkRef.current?.isConnected;
      networkRef.current = state;
      setSync((s) => ({ ...s, isOnline: !!state.isConnected }));
      if (state.isConnected && !wasOnline) autoSyncIfAllowed();
    });
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") autoSyncIfAllowed();
    });
    const timer = setInterval(autoSyncIfAllowed, SYNC_INTERVAL_MS);
    return () => {
      mounted = false;
      netSub.remove();
      appSub.remove();
      clearInterval(timer);
    };
  }, [ready, autoSyncIfAllowed]);

  const queueAndSync = useCallback(
    async (type: SyncEntityType, id: string, participantId: string) => {
      await enqueue(repo, type, id, participantId, newId);
      await refreshQueue();
      autoSyncIfAllowed();
    },
    [repo, refreshQueue, autoSyncIfAllowed]
  );

  // ---------- Auth & profile ----------

  const startSignedIn = useCallback(
    async (participantId: string) => {
      await repo.setMeta(META.participant, participantId);
      await loadParticipant(participantId);
    },
    [repo, loadParticipant]
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<ActionResult> => {
      const email = input.email.trim().toLowerCase();
      const typed = input.participantId.trim().toUpperCase();
      let participantId = typed || generateParticipantId();
      if (await repo.getProfile(participantId))
        return { ok: false, error: "participant-exists" };
      if (email && (await repo.findProfile(email))) return { ok: false, error: "email-exists" };
      // With a server, the account must exist there too or every upload would be rejected,
      // so registration needs a connection. Without one, the account is local only.
      if (isServerConfigured()) {
        const remote = await remoteRegister({
          participantId,
          generated: !typed,
          regenerate: generateParticipantId,
          fullName: input.fullName.trim(),
          email,
          password: input.password,
          classCode: input.classCode,
        });
        if (!remote.ok) return remote;
        participantId = remote.participantId;
      }
      const ts = new Date().toISOString();
      const p: StudentProfile = {
        studentId: newId(),
        participantId,
        name: input.fullName.trim(),
        email,
        grade: "",
        section: "",
        school: "",
        schoolType: "",
        medium: "",
        nativeLanguage: "",
        otherLanguages: "",
        ageGroup: "",
        gender: "",
        createdAt: ts,
        updatedAt: ts,
      };
      await repo.saveProfile(p, await hashPassword(input.password));
      await startSignedIn(participantId);
      return { ok: true };
    },
    [repo, startSignedIn]
  );

  const login = useCallback(
    async (identifier: string, password: string): Promise<ActionResult> => {
      const stored = await repo.findProfile(identifier);

      if (isServerConfigured()) {
        // The server accepts the participant ID or the registered e-mail.
        const remote = await remoteLogin(stored?.profile.participantId ?? identifier.trim(), password);
        if (remote.ok) {
          const participantId = remote.participantId;
          // Keep the local credential in step so the next offline sign-in works.
          const credential = await hashPassword(password);
          if (stored) {
            await repo.saveProfile(stored.profile, credential);
          } else {
            const ts = new Date().toISOString();
            await repo.saveProfile(
              {
                studentId: newId(),
                participantId,
                name: participantId,
                email: "",
                grade: "",
                section: "",
                school: "",
                schoolType: "",
                medium: "",
                nativeLanguage: "",
                otherLanguages: "",
                ageGroup: "",
                gender: "",
                createdAt: ts,
                updatedAt: ts,
              },
              credential
            );
          }
          await startSignedIn(participantId);
          return { ok: true };
        }
        // Offline: fall through to the copy on this phone. Any other answer from the server is final.
        if (remote.error !== "network") return remote;
      }

      if (!stored) return { ok: false, error: "not-found" };
      if (!(await verifyPassword(password, stored.credential))) return { ok: false, error: "wrong-password" };
      await startSignedIn(stored.profile.participantId);
      return { ok: true };
    },
    [repo, startSignedIn]
  );

  const logout = useCallback(async () => {
    await clearAuthToken();
    await repo.setMeta(META.participant, null);
    setProfile(null);
    setSessionId(null);
    setConsent(null);
    setReadingAttempts([]);
    setWritingAttempts([]);
    setWritingDraft(null);
  }, [repo]);

  const updateProfile = useCallback(
    async (patch: Partial<StudentProfile>) => {
      if (!profile) return;
      const next = { ...profile, ...patch, participantId: profile.participantId, updatedAt: new Date().toISOString() };
      await repo.saveProfile(next);
      await repo.setMeta(`profile.dirty.${profile.participantId}`, "1");
      setProfile(next);
      void syncProfile(repo, next).catch(() => {});
    },
    [repo, profile]
  );

  // ---------- Consent ----------

  const acceptConsent = useCallback(
    async (input: ConsentInput) => {
      if (!profile) return;
      const record: ConsentRecord = {
        ...input,
        id: newId(),
        participantId: profile.participantId,
        consentVersion: config.consentVersion,
        acceptedAt: new Date().toISOString(),
        withdrawnAt: null,
        status: "active",
      };
      await repo.saveConsent(record);
      setConsent(record);
      await queueAndSync("consent", record.id, profile.participantId);
    },
    [repo, profile, queueAndSync]
  );

  const withdrawConsent = useCallback(async () => {
    if (!consent || !profile) return;
    const next: ConsentRecord = { ...consent, status: "withdrawn", withdrawnAt: new Date().toISOString() };
    await repo.saveConsent(next);
    setConsent(next);
    await queueAndSync("consent", next.id, profile.participantId);
  }, [repo, consent, profile, queueAndSync]);

  const deleteLocalData = useCallback(async () => {
    if (!profile) return;
    for (const a of readingAttempts) deleteMedia(a.audioUri);
    for (const a of writingAttempts) deleteMedia(a.imageUri);
    await repo.deleteParticipantData(profile.participantId);
    setReadingAttempts([]);
    setWritingAttempts([]);
    await refreshQueue();
  }, [repo, profile, readingAttempts, writingAttempts, refreshQueue]);

  // ---------- Attempts ----------

  const saveNewReading = useCallback(
    async (input: NewReading) => {
      if (!profile || !sessionId) throw new Error("Not signed in");
      const audioUri = input.audioUri
        ? await persistMedia(input.audioUri, "recordings", profile.participantId, sessionId, input.id)
        : null;
      const attempt: ReadingAttempt = {
        ...input,
        audioUri,
        participantId: profile.participantId,
        sessionId,
        createdAt: new Date().toISOString(),
        synced: false,
      };
      await repo.saveReading(attempt);
      setReadingAttempts((list) => [attempt, ...list]);
      await queueAndSync("reading", attempt.id, attempt.participantId);
      return attempt;
    },
    [repo, profile, sessionId, queueAndSync]
  );

  const updateReadingAttempt = useCallback(
    async (id: string, patch: Partial<ReadingAttempt>) => {
      const current = await repo.getReading(id);
      if (!current) return;
      const next = { ...current, ...patch, synced: false };
      await repo.saveReading(next);
      setReadingAttempts((list) => list.map((a) => (a.id === id ? next : a)));
      await queueAndSync("reading", id, next.participantId);
    },
    [repo, queueAndSync]
  );

  const saveNewWriting = useCallback(
    async (input: NewWriting) => {
      if (!profile || !sessionId) throw new Error("Not signed in");
      const imageUri = input.imageUri
        ? await persistMedia(input.imageUri, "images", profile.participantId, sessionId, input.id)
        : null;
      const attempt: WritingAttempt = {
        ...input,
        imageUri,
        participantId: profile.participantId,
        sessionId,
        createdAt: new Date().toISOString(),
        synced: false,
      };
      await repo.saveWriting(attempt);
      setWritingAttempts((list) => [attempt, ...list]);
      await queueAndSync("writing", attempt.id, attempt.participantId);
      return attempt;
    },
    [repo, profile, sessionId, queueAndSync]
  );

  const updateWritingAttempt = useCallback(
    async (id: string, patch: Partial<WritingAttempt>) => {
      const current = await repo.getWriting(id);
      if (!current) return;
      const next = { ...current, ...patch, synced: false };
      await repo.saveWriting(next);
      setWritingAttempts((list) => list.map((a) => (a.id === id ? next : a)));
      await queueAndSync("writing", id, next.participantId);
    },
    [repo, queueAndSync]
  );

  // ---------- Sync controls ----------

  const setAutoSync = useCallback(
    async (v: boolean) => {
      autoSyncRef.current = v;
      await repo.setMeta(META.autoSync, v ? "true" : "false");
      setSync((s) => ({ ...s, autoSync: v }));
      if (v) autoSyncIfAllowed();
    },
    [repo, autoSyncIfAllowed]
  );

  const retrySyncItem = useCallback(
    async (item: SyncItem) => {
      await retryItem(repo, item);
      await refreshQueue();
      void runSyncRef.current();
    },
    [repo, refreshQueue]
  );

  const myQueue = useMemo(
    () => (profile ? queue.filter((q) => q.participantId === profile.participantId) : []),
    [queue, profile]
  );
  const pendingCount = myQueue.filter((q) => q.status !== "synced").length;
  const failedCount = myQueue.filter((q) => q.status === "failed").length;

  const value: AppStateValue = {
    ready,
    lang,
    toggleLang,
    isAuthenticated: !!profile,
    profile,
    profileComplete: !!profile && !!profile.grade && !!profile.school,
    register,
    login,
    logout,
    updateProfile,
    consent,
    hasActiveConsent: consent?.status === "active" && consent.consentVersion === config.consentVersion,
    acceptConsent,
    withdrawConsent,
    deleteLocalData,
    readingAttempts,
    writingAttempts,
    saveNewReading,
    updateReadingAttempt,
    saveNewWriting,
    updateWritingAttempt,
    requestFeedbackFor: readingFeedback,
    requestWritingAssessmentFor: writingFeedback,
    writingDraft,
    setWritingDraft,
    sync,
    queue: myQueue,
    pendingCount,
    failedCount,
    setAutoSync,
    syncNow: runSync,
    retrySyncItem,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppStateValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Where a signed-in student should land: consent first, then profile details, then home. */
export function useEntryRoute(): "/consent" | "/profile-setup" | "/home" | null {
  const { isAuthenticated, hasActiveConsent, profileComplete } = useApp();
  if (!isAuthenticated) return null;
  if (!hasActiveConsent) return "/consent";
  if (!profileComplete) return "/profile-setup";
  return "/home";
}
