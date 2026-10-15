import type { AssessmentLanguage } from "@/constants/content";
import { normalizeWord, tokenize } from "@/features/reading/analyzer";

export interface WritingMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  uniqueWordRatio: number;
  longWordCount: number;
}

/** Sentence terminators for English and Kannada (Kannada also uses the danda). */
const SENTENCE_END = /[.!?।]+/;

export function countWords(text: string): number {
  return tokenize(text).length;
}

export function countSentences(text: string): number {
  return text
    .split(SENTENCE_END)
    .map((s) => s.trim())
    .filter((s) => tokenize(s).length > 0).length;
}

export function computeWritingMetrics(text: string, language: AssessmentLanguage): WritingMetrics {
  const words = tokenize(text);
  const normalized = words.map(normalizeWord);
  const sentenceCount = countSentences(text);
  const longThreshold = language === "Kannada" ? 6 : 7;

  return {
    wordCount: words.length,
    sentenceCount,
    avgSentenceLength:
      sentenceCount === 0 ? 0 : Math.round((words.length / sentenceCount) * 10) / 10,
    uniqueWordRatio:
      words.length === 0
        ? 0
        : Math.round((new Set(normalized).size / words.length) * 100) / 100,
    longWordCount: normalized.filter((w) => Array.from(w).length >= longThreshold).length,
  };
}
