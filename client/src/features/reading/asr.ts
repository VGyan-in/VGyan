import type { AssessmentLanguage } from "@/constants/content";
import { tokenize } from "./analyzer";

export interface AsrRequest {
  audioUri: string | null;
  language: AssessmentLanguage;
  referenceText: string;
  durationMs: number;
}

export interface AsrResult {
  transcript: string;
  confidence: number;
  modelVersion: string;
}

/**
 * Speech recognition entry point.
 *
 * STUB: on-device Vosk (react-native-vosk + TDNN models) needs a development
 * build and the model files, so this simulates a transcript from the reference
 * text with a few realistic reading errors. Swap the body for the Vosk call;
 * the screens only depend on this signature.
 */
export async function transcribe(req: AsrRequest): Promise<AsrResult> {
  await new Promise((r) => setTimeout(r, 1400));

  const words = tokenize(req.referenceText);
  const rand = seededRandom(hash(`${req.audioUri ?? ""}:${req.durationMs}`));
  // Students who read for a very short time likely stopped early.
  const expectedMs = (words.length / (req.language === "Kannada" ? 60 : 85)) * 60000;
  const readFraction = Math.min(1, Math.max(0.35, req.durationMs / (expectedMs * 0.6)));
  const lastIndex = Math.ceil(words.length * readFraction);

  const spoken: string[] = [];
  for (let i = 0; i < lastIndex; i++) {
    const w = words[i];
    const roll = rand();
    if (roll < 0.04) continue; // omission
    if (roll < 0.09) {
      spoken.push(mutate(w));
      continue;
    }
    spoken.push(w);
    if (roll > 0.985) spoken.push(req.language === "Kannada" ? "ಅದು" : "the"); // insertion
  }

  return {
    transcript: spoken.join(" "),
    confidence: Math.round((0.82 + rand() * 0.14) * 100) / 100,
    modelVersion: `mock-vosk-${req.language === "Kannada" ? "kn" : "en"}-0.1`,
  };
}

function mutate(word: string): string {
  const clean = word.replace(/[^\p{L}\p{M}\p{N}]/gu, "");
  if (clean.length <= 2) return clean + clean.slice(-1);
  const chars = Array.from(clean);
  chars.splice(Math.floor(chars.length / 2), 1);
  return chars.join("");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
