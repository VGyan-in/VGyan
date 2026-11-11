import type { AssessmentLanguage } from "@/constants/content";
import { ApiError, postJson } from "@/core/api/client";
import { isServerConfigured } from "@/core/config";
import type { AlignedWord } from "@/features/reading/analyzer";
import { normalizeWord, tokenize } from "@/features/reading/analyzer";

/**
 * AI feedback comes only from the backend (`/ai/*`, Gemini). The app never generates AI-looking
 * feedback or writing scores locally: without a connection the attempt stays `pending` and is
 * completed on the next sync. Deterministic metrics are computed on the phone and are never
 * changed by the AI.
 */

export interface AiFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  suggestions?: string[];
  /** Words the model recommends practising; for reading these are pruned to words in the passage. */
  practiceWords?: string[];
  modelVersion: string;
  promptVersion: string;
}

export interface WritingAssessment extends AiFeedback {
  grammarScore: number;
  vocabularyScore: number;
  spellingScore: number;
  /** Overall score out of 10. */
  score: number;
  misspelled: string[];
  /** Minimal grammar/spelling correction of the student's text. Never replaces `correctedText` on the attempt. */
  correctedText?: string;
}

export class AiUnavailableError extends Error {
  constructor(message = "AI feedback needs an internet connection") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export interface ReadingFeedbackInput {
  attemptId: string;
  level: string;
  accuracy: number;
  wpm: number;
  pace: string;
  substitutions: number;
  omissions: number;
  insertions: number;
  practiceWords: string[];
  words: AlignedWord[];
  referenceText: string;
  transcript: string;
}

export async function requestReadingFeedback(input: ReadingFeedbackInput, language: AssessmentLanguage): Promise<AiFeedback> {
  if (!isServerConfigured()) throw new AiUnavailableError("No server configured");
  const res = await postJson<RemoteFeedback>(
    "/ai/reading-feedback",
    {
      attempt_id: input.attemptId,
      language,
      level: input.level,
      reference_text: input.referenceText,
      transcript: input.transcript,
      metrics: {
        accuracy: input.accuracy,
        wpm: input.wpm,
        pace: input.pace,
        substitutions: input.substitutions,
        omissions: input.omissions,
        insertions: input.insertions,
        practice_words: input.practiceWords,
      },
      mistakes: input.words.filter((w) => w.status === "substitution" || w.status === "omission").slice(0, 40),
    },
    { timeoutMs: 60_000 }
  );
  const feedback = fromRemote(res);
  // Defence in depth (the server prunes too): practice words must come from the passage.
  const vocab = new Set(tokenize(input.referenceText).map(normalizeWord));
  const kept = (feedback.practiceWords ?? []).filter((w) => vocab.has(normalizeWord(w)));
  feedback.practiceWords = (kept.length > 0 ? kept : input.practiceWords).slice(0, 10);
  return feedback;
}

export async function requestWritingAssessment(input: {
  attemptId: string;
  text: string;
  language: AssessmentLanguage;
  prompt: string;
  minWords: number;
  grade: string;
}): Promise<WritingAssessment> {
  if (!isServerConfigured()) throw new AiUnavailableError("No server configured");
  const res = await postJson<RemoteWritingAssessment>(
    "/ai/writing-assessment",
    {
      attempt_id: input.attemptId,
      language: input.language,
      text: input.text,
      prompt: input.prompt,
      grade: input.grade,
      min_words: input.minWords,
    },
    { timeoutMs: 60_000 }
  );
  return {
    ...fromRemote(res),
    grammarScore: bounded(res.grammar_score, 0, 100, "grammar_score"),
    vocabularyScore: bounded(res.vocabulary_score, 0, 100, "vocabulary_score"),
    spellingScore: bounded(res.spelling_score, 0, 100, "spelling_score"),
    score: bounded(res.score, 0, 10, "score"),
    misspelled: strings(res.misspelled),
    correctedText: typeof res.corrected === "string" ? res.corrected : undefined,
  };
}

/** True for errors worth retrying later (offline, server busy, consent not yet synced). */
export function isRetryableAiError(e: unknown): boolean {
  if (e instanceof AiUnavailableError) return true;
  if (e instanceof ApiError) return e.status === null || e.status === 401 || e.status === 428 || e.status === 429 || e.status >= 500;
  return true;
}

/** Response keys from backend/app/schemas.py (ReadingFeedbackOut / WritingAssessmentOut). */
interface RemoteFeedback {
  summary?: unknown;
  working_well?: unknown;
  needs_improvement?: unknown;
  suggestions?: unknown;
  practice_words?: unknown;
  model_version?: unknown;
  prompt_version?: unknown;
}

interface RemoteWritingAssessment extends RemoteFeedback {
  corrected?: unknown;
  grammar_score?: unknown;
  vocabulary_score?: unknown;
  spelling_score?: unknown;
  score?: unknown;
  misspelled?: unknown;
}

function fromRemote(res: RemoteFeedback): AiFeedback {
  if (typeof res.model_version !== "string" || typeof res.prompt_version !== "string") {
    throw new Error("AI response is missing model_version/prompt_version");
  }
  if (typeof res.summary !== "string" || res.summary.trim() === "") throw new Error("AI response has no summary");
  return {
    summary: res.summary,
    strengths: strings(res.working_well),
    improvements: strings(res.needs_improvement),
    suggestions: strings(res.suggestions),
    practiceWords: strings(res.practice_words),
    modelVersion: res.model_version,
    promptVersion: res.prompt_version,
  };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

function bounded(v: unknown, min: number, max: number, key: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`AI response has invalid ${key}`);
  return v;
}
