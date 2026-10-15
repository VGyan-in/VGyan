import type { AssessmentLanguage } from "@/constants/content";

export interface OcrResult {
  text: string;
  confidence: number;
  engineVersion: string;
}

/**
 * Handwriting OCR.
 *
 * STUB: the real call is `POST /ocr` on the backend (keeps OCR credentials off
 * the device). Until that exists this returns a sample transcription with a few
 * typical OCR slips, so the correction screen can be exercised end to end.
 */
export async function recognizeHandwriting(
  _imageUri: string,
  language: AssessmentLanguage
): Promise<OcrResult> {
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
