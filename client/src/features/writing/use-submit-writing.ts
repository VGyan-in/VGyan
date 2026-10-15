import { useCallback } from "react";
import { getWritingPrompt } from "@/constants/content";
import { newId } from "@/core/auth/credentials";
import { requestWritingAssessment } from "@/features/feedback/ai";
import { computeWritingMetrics } from "@/features/writing/metrics";
import { useApp, WritingDraft } from "@/state/app-store";

/**
 * Saves a writing attempt to the phone first (so nothing is lost offline), then
 * requests the AI assessment and updates the attempt when it arrives.
 * Resolves to the new attempt id.
 */
export function useSubmitWriting() {
  const { saveNewWriting, updateWritingAttempt } = useApp();

  return useCallback(
    async (draft: WritingDraft): Promise<string | null> => {
      const prompt = getWritingPrompt(draft.promptId);
      if (!prompt) return null;
      const text = draft.text.trim();
      const metrics = computeWritingMetrics(text, prompt.language);

      const attempt = await saveNewWriting({
        id: newId(),
        promptId: prompt.id,
        prompt: prompt.prompt,
        kannadaPrompt: prompt.kannadaPrompt,
        language: prompt.language,
        inputMethod: draft.inputMethod,
        imageUri: draft.imageUri,
        originalOcr: draft.originalOcr,
        ocrConfidence: draft.ocrConfidence,
        correctedText: text,
        wordCount: metrics.wordCount,
        sentenceCount: metrics.sentenceCount,
        score: 0,
        grammarScore: 0,
        vocabularyScore: 0,
        spellingScore: 0,
        aiStatus: "pending",
      });

      requestWritingAssessment(text, metrics, prompt.language, prompt.minWords)
        .then((assessment) =>
          updateWritingAttempt(attempt.id, {
            assessment,
            aiStatus: "completed",
            score: assessment.score,
            grammarScore: assessment.grammarScore,
            vocabularyScore: assessment.vocabularyScore,
            spellingScore: assessment.spellingScore,
          })
        )
        .catch(() => updateWritingAttempt(attempt.id, { aiStatus: "failed" }));

      return attempt.id;
    },
    [saveNewWriting, updateWritingAttempt]
  );
}
