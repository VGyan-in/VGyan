import { File } from "expo-file-system";
import type { AssessmentLanguage } from "@/constants/content";
import { VgyanSpeech, type RecognitionResult } from "../../../modules/vgyan-speech";
import { ensureModelLoaded, getModelState } from "./models";
import type { AsrWord } from "./fluency";

export interface AsrResult {
  transcript: string;
  /** Mean Vosk word confidence (0..1); null when no words were recognised. */
  confidence: number | null;
  modelVersion: string;
  words: AsrWord[];
  /** Recognition time after the recording stopped (or for the whole file). */
  asrMs: number | null;
}

export class AsrUnavailableError extends Error {
  constructor(readonly reason: "unsupported" | "no-model") {
    super(reason === "unsupported" ? "Speech engine not available in this build" : "Speech model not installed");
  }
}

/** Converts the native result; `null` text means recognition did not run during recording. */
export function fromNative(r: RecognitionResult, modelVersion: string): AsrResult | null {
  if (r.text == null) return null;
  return {
    transcript: r.text.trim(),
    confidence: r.confidence ?? null,
    modelVersion,
    words: (r.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end, conf: w.conf })),
    asrMs: r.asrMs ?? null,
  };
}

/**
 * Offline recognition of a saved 16 kHz WAV with the installed Vosk model. Used when the model was
 * not ready during recording, and to transcribe "pending" recordings after a model is installed.
 * Never falls back to anything online and never invents a transcript.
 */
export async function transcribeFile(audioUri: string, language: AssessmentLanguage): Promise<AsrResult> {
  if (!VgyanSpeech) throw new AsrUnavailableError("unsupported");
  if (!audioUri.toLowerCase().endsWith(".wav")) throw new Error("Only WAV recordings can be transcribed offline");
  if (!new File(audioUri).exists) throw new Error("Recording file is missing on this phone");
  const spec = await ensureModelLoaded(language);
  if (!spec) throw new AsrUnavailableError(getModelState(language).status === "unsupported" ? "unsupported" : "no-model");
  const res = fromNative(await VgyanSpeech.transcribeFile(audioUri, spec.key), spec.version);
  if (!res) throw new Error("Recognition returned no result");
  return res;
}

// ---- hand-off from the recording screen to the processing screen (too large for route params) ----

export interface RecordingHandoff {
  audioUri: string;
  durationMs: number;
  asr: AsrResult | null;
}

const handoffs = new Map<string, RecordingHandoff>();

export function putHandoff(id: string, h: RecordingHandoff) {
  handoffs.set(id, h);
}

export function takeHandoff(id: string | undefined): RecordingHandoff | null {
  if (!id) return null;
  const h = handoffs.get(id) ?? null;
  handoffs.delete(id);
  return h;
}
