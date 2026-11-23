import { requireOptionalNativeModule } from "expo";

export interface EventSubscription {
  remove(): void;
}

export interface RecognizedWord {
  word: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
  /** 0..1, or -1 when the engine gave none. */
  conf: number;
}

export interface RecognitionResult {
  text: string | null;
  words: RecognizedWord[] | null;
  /** Mean word confidence, or null when nothing was recognised. */
  confidence: number | null;
  /** Time spent finishing recognition after the student stopped (streaming) or for the whole file. */
  asrMs: number | null;
}

export interface StopResult extends RecognitionResult {
  uri: string;
  /** Audio duration from the number of samples written. */
  durationMs: number;
  wallClockMs: number;
  bytes: number;
  sampleRate: number;
}

interface NativeSpeech {
  loadModel(key: string, path: string): Promise<boolean>;
  isModelLoaded(key: string): boolean;
  unloadModel(key: string): Promise<void>;
  unzip(zipPath: string, destDir: string): Promise<string>;
  startRecording(outputPath: string, modelKey: string | null): Promise<{ recognizing: boolean }>;
  stopRecording(): Promise<StopResult>;
  cancelRecording(): Promise<void>;
  transcribeFile(wavPath: string, modelKey: string): Promise<RecognitionResult>;
  addListener(event: "onLevel", cb: (e: { level: number }) => void): EventSubscription;
}

/** Null on web, in Expo Go and in Jest: callers must handle "speech engine unavailable". */
export const VgyanSpeech = requireOptionalNativeModule<NativeSpeech>("VgyanSpeech");

export const isSpeechAvailable = () => VgyanSpeech != null;
