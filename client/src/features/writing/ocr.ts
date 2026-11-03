import { Platform } from "react-native";
import type { AssessmentLanguage } from "@/constants/content";
import { postForm } from "@/core/api/client";
import { isServerConfigured } from "@/core/config";

export interface OcrResult {
  text: string;
  confidence: number;
  engineVersion: string;
}

interface RemoteOcr {
  text?: unknown;
  confidence?: unknown;
  engine_version?: unknown;
}

/**
 * Handwriting OCR.
 *
 * With a server configured this sends the original photo to `POST /ocr` (OCR
 * credentials stay on the backend). Kannada needs a multi-language engine there;
 * OCR.space engine 1 rejects "kan" with E201, so the backend should use engine 2.
 * Without a server it returns a sample transcription so the correction screen
 * can still be exercised end to end.
 */
export async function recognizeHandwriting(
  imageUri: string,
  language: AssessmentLanguage
): Promise<OcrResult> {
  if (!isServerConfigured()) return sampleOcr(language);

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
    text: res.text.trim(),
    confidence: typeof res.confidence === "number" ? res.confidence : 0,
    engineVersion: typeof res.engine_version === "string" ? res.engine_version : "unknown",
  };
}

async function sampleOcr(language: AssessmentLanguage): Promise<OcrResult> {
  await new Promise((r) => setTimeout(r, 1600));

  const text =
    language === "Kannada"
      ? "ನಮ್ಮ ಪರಿಸರವನ್ನು ಉಳಿಸುವುದು ನಮ್ಮ ಕರ್ತವ್ಯ. ನಾವು ಹೆಚ್ಚು ಮರಗಳನ್ನು ನೆಡಬೇಕು. ನೀರನ್ನು ವ್ಯರ್ಥ ಮಾಡಬಾರದು. ಪ್ಲಾಸ್ಟಿಕ್ ಚೀಲಗಳ ಬದಲು ಬಟ್ಟೆಯ ಚೀಲ ಬಳಸಬೇಕು. ಶಾಲೆಯಲ್ಲಿ ಎಲ್ಲರೂ ಸೇರಿ ಸ್ವಚ್ಛತೆ ಮಾಡಬೇಕು."
      : "My favourite festival is Deepavali. We clean our house and draw rangoli in front of the door. My mother makes sweets like laddu and holige. In the evening we light diyas and wear new clothes. I enjoy bursting crakers with my cousins but I am carefull. Deepavali makes every one in my family very hapy.";

  return {
    text,
    confidence: language === "Kannada" ? 0.81 : 0.88,
    engineVersion: "mock-ocr-0.1",
  };
}
