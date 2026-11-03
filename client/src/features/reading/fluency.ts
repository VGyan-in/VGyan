import { normalizeWord } from "./analyzer";

/** One recognised word with timing, as Vosk returns with `setWords(true)`. Times in seconds. */
export interface AsrWord {
  word: string;
  start: number;
  end: number;
  /** 0..1, or -1 when the engine gave no confidence. */
  conf: number;
}

export interface FluencyMetrics {
  /** Silent gaps between words at or above the pause threshold. */
  pauseCount: number;
  totalPauseSec: number;
  longestPauseSec: number;
  /** Same word said twice in a row ("the the"), a common disfluency marker. */
  immediateRepetitions: number;
  /** Hesitation sounds ("um", "uh", ...) recognised as words. */
  fillerCount: number;
  /** Words per minute counting only time spent speaking (excludes pauses). */
  articulationRate: number;
  /** Words the recogniser was unsure about; a proxy for unclear pronunciation. */
  lowConfidenceWords: string[];
}

export const FLUENCY_CONFIG = {
  pauseThresholdSec: 0.25,
  lowConfidence: 0.6,
};

// Kept to hesitation sounds only: discourse words like "so" or "like" occur in
// passages and would be miscounted in scripted reading.
const FILLERS = new Set(["uh", "um", "umm", "erm", "hmm", "mmm", "ah", "er"]);

/**
 * Fluency measures from word timestamps. Port of the client's
 * StudentSkillManager EvaluationEngine, limited to what holds up for scripted
 * reading in both English and Kannada (its English-only syllable rate is dropped).
 */
export function computeFluency(words: AsrWord[], cfg = FLUENCY_CONFIG): FluencyMetrics | null {
  const ws = words
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.word.trim() !== "")
    .sort((a, b) => a.start - b.start);
  if (ws.length === 0) return null;

  let pauseCount = 0;
  let totalPause = 0;
  let longestPause = 0;
  let repetitions = 0;
  let fillers = 0;
  let speechSec = 0;
  const lowConf: string[] = [];

  ws.forEach((w, i) => {
    const norm = normalizeWord(w.word);
    speechSec += Math.max(0, w.end - w.start);
    if (FILLERS.has(norm)) fillers++;
    if (w.conf >= 0 && w.conf < cfg.lowConfidence && !lowConf.includes(norm)) lowConf.push(norm);
    if (i === 0) return;
    const prev = ws[i - 1];
    if (norm === normalizeWord(prev.word)) repetitions++;
    const gap = w.start - prev.end;
    if (gap >= cfg.pauseThresholdSec) {
      pauseCount++;
      totalPause += gap;
      longestPause = Math.max(longestPause, gap);
    }
  });

  return {
    pauseCount,
    totalPauseSec: round2(totalPause),
    longestPauseSec: round2(longestPause),
    immediateRepetitions: repetitions,
    fillerCount: fillers,
    articulationRate: speechSec > 0 ? Math.round(((ws.length - fillers) / speechSec) * 60) : 0,
    lowConfidenceWords: lowConf,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
