import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReadingAttempt, SyncItem, WritingAttempt } from "@/types/models";

jest.mock("@/core/storage/secure", () => ({
  secureStore: { get: jest.fn(async () => "tok"), set: jest.fn(), remove: jest.fn() },
}));
jest.mock("@/core/storage/files", () => ({ localMd5: jest.fn(() => "abc123") }));

const reading = (over: Partial<ReadingAttempt> = {}): ReadingAttempt => ({
  id: "r1",
  participantId: "VG-1",
  sessionId: "s1",
  passageId: "P-EN-E1",
  title: "My Pet Cat",
  kannadaTitle: "",
  language: "English",
  level: "Easy",
  createdAt: "2026-11-01T10:00:00.000Z",
  referenceText: "The boy went to school.",
  asrStatus: "completed",
  transcript: "the boy go to school",
  audioUri: "file:///data/recordings/VG-1/s1/r1.wav",
  durationSec: 6,
  asrConfidence: 0.9,
  asrModelVersion: "vosk-model-small-en-in-0.4",
  accuracy: 80,
  wpm: 50,
  wcpm: 40,
  pace: "Slow",
  mistakesCount: 1,
  substitutions: 1,
  omissions: 0,
  insertions: 0,
  practiceWords: ["went"],
  words: [],
  aiStatus: "pending",
  synced: false,
  serverFileMd5: "old",
  ...over,
});

const item = (entityType: SyncItem["entityType"], entityId: string): SyncItem => ({
  id: "q1",
  entityType,
  entityId,
  participantId: "VG-1",
  status: "uploading",
  attempts: 0,
  lastError: null,
  permanent: false,
  nextRetryAt: null,
  createdAt: "",
  updatedAt: "",
});

function load() {
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
  let mod!: typeof import("@/core/sync/uploader");
  let mem!: typeof import("@/core/db/memory-repository");
  jest.isolateModules(() => {
    mod = require("@/core/sync/uploader");
    mem = require("@/core/db/memory-repository");
  });
  return { ...mod, repo: mem.createMemoryRepository() };
}

let sent: { url: string; body: FormData }[] = [];
// React Native FormData takes { uri, name, type } file parts; Node's stringifies them, so capture the call.
const filePart = () => {
  const call = (appendSpy.mock.calls as unknown[][]).find((c) => c[0] === "file");
  return call ? (call[1] as unknown as { name: string; type: string }) : undefined;
};
let appendSpy: ReturnType<typeof jest.spyOn>;
const respond = (status: number, body: unknown = {}) => {
  global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body as FormData });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
};

beforeEach(() => {
  sent = [];
  appendSpy = jest.spyOn(FormData.prototype, "append");
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  appendSpy.mockRestore();
});

describe("record payloads", () => {
  it("never sends device-only fields", () => {
    const { readingPayload } = load();
    const p = readingPayload(reading(), "abc123");
    expect(p).not.toHaveProperty("audioUri");
    expect(p).not.toHaveProperty("synced");
    expect(p).not.toHaveProperty("serverFileMd5");
    expect(p.audioMd5).toBe("abc123");
  });

  it("sends no metrics for a reading that is still waiting for transcription", () => {
    const { readingPayload } = load();
    const p = readingPayload(reading({ asrStatus: "pending", transcript: "", accuracy: 0 }), null);
    expect(p.accuracy).toBeNull();
    expect(p.substitutions).toBeNull();
    expect(p.words).toEqual([]);
  });
});

describe("uploader", () => {
  it("uploads the record with the audio and stores the server's checksum receipt", async () => {
    const { createUploader, repo } = load();
    await repo.saveReading(reading());
    respond(200, { status: "created", file_md5: "abc123" });
    const out = await createUploader(repo)(item("reading", "r1"));
    expect(out).toEqual({ kind: "ok" });
    expect(sent[0].url).toBe("https://api.test/sync/reading");
    const record = JSON.parse(String(sent[0].body.get("record")));
    expect(record.id).toBe("r1");
    expect(filePart()).toMatchObject({ name: "r1.wav", type: "audio/wav" });
    expect((await repo.getReading("r1"))?.serverFileMd5).toBe("abc123");
  });

  it("retries when the server has no consent yet (428), is down, or is unreachable", async () => {
    const { createUploader, repo } = load();
    await repo.saveReading(reading());
    respond(428, { error: { code: "consent_required", message: "No active research consent" } });
    expect((await createUploader(repo)(item("reading", "r1"))).kind).toBe("retry");
    respond(503);
    expect((await createUploader(repo)(item("reading", "r1"))).kind).toBe("retry");
    global.fetch = jest.fn(async () => {
      throw new Error("Network request failed");
    }) as unknown as typeof fetch;
    expect((await createUploader(repo)(item("reading", "r1"))).kind).toBe("retry");
  });

  it("stops and surfaces problems a person must look at", async () => {
    const { createUploader, repo } = load();
    await repo.saveReading(reading());
    respond(403, { error: { code: "participant_mismatch", message: "Record belongs to a different participant" } });
    const out = await createUploader(repo)(item("reading", "r1"));
    expect(out).toEqual({ kind: "fatal", error: "HTTP 403: Record belongs to a different participant" });
    respond(422, { error: { message: "Source fields cannot change" } });
    expect((await createUploader(repo)(item("reading", "r1"))).kind).toBe("fatal");
  });

  it("treats a legacy 409 duplicate as received", async () => {
    const { createUploader, repo } = load();
    await repo.saveReading(reading());
    respond(409);
    expect((await createUploader(repo)(item("reading", "r1"))).kind).toBe("ok");
  });

  it("keeps the original OCR and the correction as separate fields", async () => {
    const { createUploader, repo } = load();
    const w: WritingAttempt = {
      id: "w1",
      participantId: "VG-1",
      sessionId: "s1",
      promptId: "W-EN-1",
      prompt: "Festival",
      kannadaPrompt: "",
      language: "English",
      createdAt: "2026-11-01T10:00:00.000Z",
      inputMethod: "camera",
      imageUri: "file:///img/w1.jpg",
      originalOcr: "My favrite festival",
      ocrConfidence: null,
      ocrId: "ocr-1",
      correctedText: "My favourite festival",
      wordCount: 3,
      sentenceCount: 1,
      score: 0,
      grammarScore: 0,
      vocabularyScore: 0,
      spellingScore: 0,
      aiStatus: "pending",
      synced: false,
    };
    await repo.saveWriting(w);
    respond(200, { file_md5: "abc123" });
    await createUploader(repo)(item("writing", "w1"));
    const record = JSON.parse(String(sent[0].body.get("record")));
    expect(record.originalOcr).toBe("My favrite festival");
    expect(record.correctedText).toBe("My favourite festival");
    expect(record.ocrId).toBe("ocr-1");
    expect(record.imageMd5).toBe("abc123");
    expect(filePart()).toMatchObject({ type: "image/jpeg" });
  });
});
