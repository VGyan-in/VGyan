import type { AssessmentLanguage } from "@/constants/content";

export type WordStatus = "correct" | "substitution" | "omission" | "insertion";

export interface AlignedWord {
  status: WordStatus;
  /** Reference word as displayed (original casing/punctuation). Absent for insertions. */
  ref?: string;
  /** Word the reader actually said. Absent for omissions. */
  hyp?: string;
}

export interface ReadingAnalysis {
  words: AlignedWord[];
  referenceWordCount: number;
  spokenWordCount: number;
  correct: number;
  substitutions: number;
  omissions: number;
  insertions: number;
  accuracy: number;
  wpm: number;
  wcpm: number;
  pace: Pace;
  mistakes: number;
  practiceWords: string[];
}

export type Pace = "Slow" | "Steady" | "Fluent" | "Fast";

const ZERO_WIDTH = /[​-‍﻿]/g;
const NON_WORD = /[^\p{L}\p{M}\p{N}\s]/gu;

/** Normalises one token for comparison: NFC, zero-width joiners removed, punctuation stripped, lowercased. */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(/[’']/g, "")
    .replace(NON_WORD, "")
    .toLowerCase();
}

/** Splits text into display tokens, dropping tokens that are pure punctuation. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .split(/\s+/)
    .filter((t) => normalizeWord(t).length > 0);
}

/**
 * Word-level Levenshtein alignment with backtrace.
 * The backtrace runs from the end, and on equal cost prefers an omission, then a
 * match/substitution, then an insertion. This aligns spoken words as early in the
 * passage as possible, so a student who stops early gets "not reached" words at
 * the end rather than a late word matched far down the passage.
 */
export function alignWords(reference: string[], spoken: string[]): AlignedWord[] {
  const r = reference.map(normalizeWord);
  const h = spoken.map(normalizeWord);
  const n = r.length;
  const m = h.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }

  const out: AlignedWord[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      out.push({ status: "omission", ref: reference[i - 1] });
      i--;
      continue;
    }
    if (i > 0 && j > 0) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + cost) {
        out.push({
          status: cost === 0 ? "correct" : "substitution",
          ref: reference[i - 1],
          hyp: spoken[j - 1],
        });
        i--;
        j--;
        continue;
      }
    }
    out.push({ status: "insertion", hyp: spoken[j - 1] });
    j--;
  }
  return out.reverse();
}

/** Accuracy = correct reference words / total reference words × 100. */
export function computeAccuracy(correct: number, referenceWordCount: number): number {
  if (referenceWordCount === 0) return 0;
  return Math.round((correct / referenceWordCount) * 1000) / 10;
}

/** WPM = words spoken / reading time in minutes. */
export function computeWpm(spokenWordCount: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.round(spokenWordCount / (durationMs / 60000));
}

/** WCPM = words read correctly / reading time in minutes. */
export function computeWcpm(correct: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.round(correct / (durationMs / 60000));
}

/**
 * Pace band from WPM. Kannada words are longer on average, so its bands are lower.
 * TODO: replace thresholds with the SRS-defined bands once confirmed with the mentor.
 */
export function computePace(wpm: number, language: AssessmentLanguage): Pace {
  const [slow, steady, fluent] = language === "Kannada" ? [40, 70, 100] : [60, 90, 130];
  if (wpm < slow) return "Slow";
  if (wpm < steady) return "Steady";
  if (wpm < fluent) return "Fluent";
  return "Fast";
}

/** Practice words: unique reference words that were substituted or omitted, in reading order. */
export function selectPracticeWords(words: AlignedWord[], limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const w of words) {
    if ((w.status === "substitution" || w.status === "omission") && w.ref) {
      const clean = w.ref.replace(NON_WORD, "");
      const key = normalizeWord(clean);
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(clean);
      }
    }
    if (result.length >= limit) break;
  }
  return result;
}

export function analyzeReading(
  referenceText: string,
  transcript: string,
  durationMs: number,
  language: AssessmentLanguage
): ReadingAnalysis {
  const reference = tokenize(referenceText);
  const spoken = tokenize(transcript);
  const words = alignWords(reference, spoken);

  const count = (s: WordStatus) => words.filter((w) => w.status === s).length;
  const correct = count("correct");
  const substitutions = count("substitution");
  const omissions = count("omission");
  const insertions = count("insertion");
  const wpm = computeWpm(spoken.length, durationMs);

  return {
    words,
    referenceWordCount: reference.length,
    spokenWordCount: spoken.length,
    correct,
    substitutions,
    omissions,
    insertions,
    accuracy: computeAccuracy(correct, reference.length),
    wpm,
    wcpm: computeWcpm(correct, durationMs),
    pace: computePace(wpm, language),
    mistakes: substitutions + omissions + insertions,
    practiceWords: selectPracticeWords(words),
  };
}
