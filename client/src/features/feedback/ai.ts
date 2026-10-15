import type { AssessmentLanguage } from "@/constants/content";
import type { ReadingAnalysis } from "@/features/reading/analyzer";
import type { WritingMetrics } from "@/features/writing/metrics";
import { normalizeWord, tokenize } from "@/features/reading/analyzer";

export interface AiFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
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
}

const STUB_MODEL = "local-stub";
const STUB_PROMPT = "v0";

/**
 * Qualitative reading feedback. Metrics are computed on-device; the model only
 * writes feedback around them.
 *
 * STUB for `POST /ai/reading-feedback`. Generates rule-based feedback locally so
 * the result screen is complete offline and before the backend exists.
 */
export type ReadingFeedbackInput = Pick<
  ReadingAnalysis,
  "accuracy" | "wpm" | "omissions" | "practiceWords"
> & { pace: string };

export async function requestReadingFeedback(
  analysis: ReadingFeedbackInput,
  language: AssessmentLanguage
): Promise<AiFeedback> {
  await new Promise((r) => setTimeout(r, 900));
  const kn = language === "Kannada";
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (analysis.accuracy >= 90) strengths.push(kn ? "ಪದಗಳನ್ನು ಬಹಳ ನಿಖರವಾಗಿ ಓದಿದ್ದೀರಿ." : "You read the words very accurately.");
  else if (analysis.accuracy >= 75) strengths.push(kn ? "ಹೆಚ್ಚಿನ ಪದಗಳನ್ನು ಸರಿಯಾಗಿ ಓದಿದ್ದೀರಿ." : "You read most of the words correctly.");
  else improvements.push(kn ? "ಪ್ರತಿ ಪದವನ್ನು ನಿಧಾನವಾಗಿ ಮತ್ತು ಸ್ಪಷ್ಟವಾಗಿ ಓದಲು ಪ್ರಯತ್ನಿಸಿ." : "Try reading each word slowly and clearly.");

  if (analysis.pace === "Fluent" || analysis.pace === "Steady")
    strengths.push(kn ? "ನಿಮ್ಮ ಓದುವ ವೇಗ ಉತ್ತಮವಾಗಿದೆ." : "Your reading speed is comfortable to listen to.");
  else if (analysis.pace === "Slow")
    improvements.push(kn ? "ಹೆಚ್ಚು ಅಭ್ಯಾಸದಿಂದ ವೇಗ ಹೆಚ್ಚುತ್ತದೆ. ಪ್ರತಿದಿನ ಗಟ್ಟಿಯಾಗಿ ಓದಿ." : "Read aloud every day to build up speed.");
  else improvements.push(kn ? "ಸ್ವಲ್ಪ ನಿಧಾನವಾಗಿ ಓದಿ, ವಿರಾಮ ಚಿಹ್ನೆಗಳಲ್ಲಿ ನಿಲ್ಲಿ." : "Slow down a little and pause at full stops.");

  if (analysis.omissions > 2)
    improvements.push(kn ? "ಕೆಲವು ಪದಗಳನ್ನು ಬಿಟ್ಟಿದ್ದೀರಿ. ಬೆರಳಿನಿಂದ ಸಾಲನ್ನು ಅನುಸರಿಸಿ." : "Some words were skipped. Follow the line with your finger.");
  if (analysis.practiceWords.length > 0)
    improvements.push(
      (kn ? "ಈ ಪದಗಳನ್ನು ಅಭ್ಯಾಸ ಮಾಡಿ: " : "Practise these words: ") +
        analysis.practiceWords.slice(0, 4).join(", ")
    );

  return {
    summary: kn
      ? `ನೀವು ${analysis.accuracy}% ನಿಖರತೆಯೊಂದಿಗೆ ನಿಮಿಷಕ್ಕೆ ${analysis.wpm} ಪದಗಳನ್ನು ಓದಿದ್ದೀರಿ.`
      : `You read at ${analysis.wpm} words per minute with ${analysis.accuracy}% accuracy.`,
    strengths,
    improvements,
    modelVersion: STUB_MODEL,
    promptVersion: STUB_PROMPT,
  };
}

const COMMON_MISSPELLINGS = new Set([
  "crakers", "carefull", "hapy", "freind", "becuase", "beacuse", "beautifull",
  "recieve", "untill", "tommorow", "wich", "thier", "realy", "alot", "wen",
  "evry", "familly", "sweats", "favrite", "intresting", "diffrent", "togather",
]);

/**
 * Writing assessment: grammar, vocabulary, spelling scores plus feedback.
 *
 * STUB for `POST /ai/writing-assessment`. Uses simple heuristics so the flow
 * works end to end; the backend model will replace these scores.
 */
export async function requestWritingAssessment(
  text: string,
  metrics: WritingMetrics,
  language: AssessmentLanguage,
  minWords: number
): Promise<WritingAssessment> {
  await new Promise((r) => setTimeout(r, 1100));
  const kn = language === "Kannada";
  const words = tokenize(text);

  const misspelled = kn
    ? []
    : Array.from(new Set(words.map(normalizeWord).filter((w) => COMMON_MISSPELLINGS.has(w))));

  const spellingScore = clamp(100 - misspelled.length * 6 - (kn ? 10 : 0));

  const sentences = text.split(/(?<=[.!?।])\s+/).filter((s) => s.trim());
  const capitalised = kn
    ? sentences.length
    : sentences.filter((s) => /^[A-Z"']/.test(s.trim())).length;
  const endsWithPunct = /[.!?।]\s*$/.test(text.trim());
  let grammarScore = 70;
  if (sentences.length > 0) grammarScore += (capitalised / sentences.length) * 15;
  if (endsWithPunct) grammarScore += 5;
  if (metrics.avgSentenceLength >= 6 && metrics.avgSentenceLength <= 20) grammarScore += 8;
  grammarScore = clamp(grammarScore);

  const vocabularyScore = clamp(
    55 + metrics.uniqueWordRatio * 35 + Math.min(10, metrics.longWordCount)
  );

  const lengthFactor = Math.min(1, metrics.wordCount / minWords);
  const score =
    Math.round(((grammarScore + vocabularyScore + spellingScore) / 30) * (0.6 + 0.4 * lengthFactor) * 10) / 10;

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (vocabularyScore >= 80) strengths.push(kn ? "ವಿವಿಧ ಪದಗಳನ್ನು ಚೆನ್ನಾಗಿ ಬಳಸಿದ್ದೀರಿ." : "You used a good variety of words.");
  if (metrics.sentenceCount >= 4) strengths.push(kn ? "ನಿಮ್ಮ ವಿಚಾರಗಳನ್ನು ಹಲವು ವಾಕ್ಯಗಳಲ್ಲಿ ವಿವರಿಸಿದ್ದೀರಿ." : "You explained your ideas across several sentences.");
  if (spellingScore >= 95) strengths.push(kn ? "ಕಾಗುಣಿತ ಉತ್ತಮವಾಗಿದೆ." : "Your spelling is excellent.");
  if (misspelled.length > 0) improvements.push(`Check the spelling of: ${misspelled.join(", ")}.`);
  if (metrics.wordCount < minWords)
    improvements.push(
      kn
        ? `ಕನಿಷ್ಠ ${minWords} ಪದಗಳನ್ನು ಬರೆಯಲು ಪ್ರಯತ್ನಿಸಿ.`
        : `Try to write at least ${minWords} words.`
    );
  if (!kn && capitalised < sentences.length)
    improvements.push("Start every sentence with a capital letter.");
  if (metrics.avgSentenceLength > 20)
    improvements.push(kn ? "ದೀರ್ಘ ವಾಕ್ಯಗಳನ್ನು ಚಿಕ್ಕದಾಗಿ ಮಾಡಿ." : "Break very long sentences into shorter ones.");
  if (strengths.length === 0) strengths.push(kn ? "ಉತ್ತಮ ಪ್ರಯತ್ನ!" : "Good effort! Keep writing every day.");

  return {
    summary: kn
      ? `ನೀವು ${metrics.wordCount} ಪದಗಳು ಮತ್ತು ${metrics.sentenceCount} ವಾಕ್ಯಗಳನ್ನು ಬರೆದಿದ್ದೀರಿ.`
      : `You wrote ${metrics.wordCount} words in ${metrics.sentenceCount} sentences.`,
    strengths,
    improvements,
    grammarScore,
    vocabularyScore,
    spellingScore,
    score: Math.min(10, score),
    misspelled,
    modelVersion: STUB_MODEL,
    promptVersion: STUB_PROMPT,
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
