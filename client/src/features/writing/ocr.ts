import { Platform } from "react-native";
import type { AssessmentLanguage } from "@/constants/content";
import { postForm } from "@/core/api/client";
import { isServerConfigured } from "@/core/config";

export interface OcrResult {
  /** Server OCR record ID; the server later checks the synced originalOcr against it. */
  ocrId: string | null;
  text: string;
  /** Engine confidence (0..1) when the provider reports one; null otherwise (never estimated). */
  confidence: number | null;
  engineVersion: string;
}

interface RemoteOcr {
  ocr_id?: unknown;
  text?: unknown;
  confidence?: unknown;
  engine_version?: unknown;
}

export class OcrUnavailableError extends Error {
  constructor() {
    super("Handwriting recognition needs an internet connection");
    this.name = "OcrUnavailableError";
  }
}

/**
 * Handwriting OCR runs on the server (`POST /ocr`), which also keeps the original photo and the raw
 * OCR text. Kannada handwriting accuracy has not been validated yet (see docs/ocr-evaluation.md),
 * so the student always reviews and corrects the text, and both versions are stored.
 */
export async function recognizeHandwriting(imageUri: string, language: AssessmentLanguage): Promise<OcrResult> {
  if (!isServerConfigured()) throw new OcrUnavailableError();

  const body = new FormData();
  body.append("language", language === "Kannada" ? "kn" : "en");
  if (Platform.OS === "web") {
    body.append("file", await (await fetch(imageUri)).blob(), "writing.jpg");
  } else {
    // React Native FormData accepts { uri, name, type } for file parts.
    body.append("file", { uri: imageUri, name: "writing.jpg", type: "image/jpeg" } as unknown as Blob);
  }

  const res = await postForm<RemoteOcr>("/ocr", body, { timeoutMs: 120_000 });
  if (typeof res.text !== "string") throw new Error("OCR response has no text");
  return {
    ocrId: typeof res.ocr_id === "string" ? res.ocr_id : null,
    text: res.text.trim(),
    confidence: typeof res.confidence === "number" ? res.confidence : null,
    engineVersion: typeof res.engine_version === "string" ? res.engine_version : "unknown",
  };
}
