import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/core/storage/secure", () => ({ secureStore: { get: jest.fn(async () => "tok"), set: jest.fn(), remove: jest.fn() } }));

function load(server: boolean) {
  if (server) process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
  else delete process.env.EXPO_PUBLIC_API_BASE_URL;
  let ai!: typeof import("@/features/feedback/ai");
  let ocr!: typeof import("@/features/writing/ocr");
  let api!: typeof import("@/core/api/client");
  jest.isolateModules(() => {
    ai = require("@/features/feedback/ai");
    ocr = require("@/features/writing/ocr");
    api = require("@/core/api/client");
  });
  return { ai, ocr, api };
}

const input = {
  attemptId: "r1",
  level: "Easy",
  accuracy: 80,
  wpm: 50,
  pace: "Slow",
  substitutions: 1,
  omissions: 0,
  insertions: 0,
  practiceWords: ["went"],
  words: [{ status: "substitution" as const, ref: "went", hyp: "go" }],
  referenceText: "The boy went to school.",
  transcript: "the boy go to school",
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
});

describe("AI client", () => {
  it("never invents feedback without the server", async () => {
    const { ai } = load(false);
    await expect(ai.requestReadingFeedback(input, "English")).rejects.toBeInstanceOf(ai.AiUnavailableError);
    await expect(
      ai.requestWritingAssessment({ attemptId: "w", text: "x", language: "English", prompt: "", minWords: 10, grade: "" })
    ).rejects.toBeInstanceOf(ai.AiUnavailableError);
  });

  it("sends metrics and mistakes, and keeps only passage words for practice", async () => {
    const { ai } = load(true);
    let body: Record<string, unknown> = {};
    global.fetch = jest.fn(async (_u: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return ok({
        summary: "Good try!",
        working_well: ["Clear voice"],
        needs_improvement: [],
        suggestions: [],
        practice_words: ["went", "giraffe"],
        model_version: "gemini-x",
        prompt_version: "reading-feedback-v1.0",
      });
    }) as unknown as typeof fetch;
    const fb = await ai.requestReadingFeedback(input, "English");
    expect(body).toMatchObject({ attempt_id: "r1", language: "English", metrics: { accuracy: 80, substitutions: 1 } });
    expect(fb.practiceWords).toEqual(["went"]);
    expect(fb.modelVersion).toBe("gemini-x");
  });

  it("rejects out-of-range writing scores from the server", async () => {
    const { ai } = load(true);
    global.fetch = jest.fn(async () =>
      ok({
        summary: "x",
        working_well: [],
        needs_improvement: [],
        model_version: "m",
        prompt_version: "p",
        grammar_score: 140,
        vocabulary_score: 50,
        spelling_score: 50,
        score: 5,
        misspelled: [],
      })
    ) as unknown as typeof fetch;
    await expect(
      ai.requestWritingAssessment({ attemptId: "w", text: "x", language: "English", prompt: "", minWords: 10, grade: "4" })
    ).rejects.toThrow("grammar_score");
  });

  it("classifies retryable errors", () => {
    const { ai, api } = load(true);
    expect(ai.isRetryableAiError(new api.ApiError("x", null))).toBe(true);
    expect(ai.isRetryableAiError(new api.ApiError("x", 428))).toBe(true);
    expect(ai.isRetryableAiError(new api.ApiError("x", 502))).toBe(true);
    expect(ai.isRetryableAiError(new api.ApiError("x", 422))).toBe(false);
  });
});

describe("OCR client", () => {
  it("needs the server and never returns sample text", async () => {
    const { ocr } = load(false);
    await expect(ocr.recognizeHandwriting("file:///x.jpg", "Kannada")).rejects.toBeInstanceOf(ocr.OcrUnavailableError);
  });

  it("reports a missing confidence as null, not a made-up number", async () => {
    const { ocr } = load(true);
    global.fetch = jest.fn(async () =>
      ok({ ocr_id: "o1", text: " ನಮ್ಮ ಶಾಲೆ ", confidence: null, engine_version: "gemini/ocr-v1" })
    ) as unknown as typeof fetch;
    const r = await ocr.recognizeHandwriting("file:///x.jpg", "Kannada");
    expect(r).toEqual({ ocrId: "o1", text: "ನಮ್ಮ ಶಾಲೆ", confidence: null, engineVersion: "gemini/ocr-v1" });
  });
});

describe("speech models", () => {
  it("reports the engine as unsupported where the native module is absent (web, Expo Go, tests)", () => {
    const { getModelState, MODEL_SPECS } = require("@/features/reading/models");
    expect(getModelState("English")).toEqual({ status: "unsupported" });
    expect(MODEL_SPECS.English.md5).toMatch(/^[0-9a-f]{32}$/);
    expect(MODEL_SPECS.Kannada).toBeNull(); // no public Kannada model: never faked
  });
});
