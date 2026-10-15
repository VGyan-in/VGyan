import { useCallback } from "react";
import { getWritingPrompt } from "@/constants/content";
import { requestWritingAssessment } from "@/features/feedback/ai";
import { computeWritingMetrics } from "@/features/writing/metrics";
import { useApp, WritingDraft } from "@/state/app-store";
import { uuid } from "@/utils/format";

/**
 * Saves a writing attempt immediately (so nothing is lost offline), then
 * requests the AI assessment and patches the attempt when it arrives.
 * Returns the new attempt id.
 */
export function useSubmitWriting() {
  const { addWritingAttempt, updateWritingAttempt, setWritingDraft } = useApp();

  return useCallback(
    (draft: WritingDraft): string | null => {
      const prompt = getWritingPrompt(draft.promptId);
      if (!prompt) return null;
      const text = draft.text.trim();
      const metrics = computeWritingMetrics(text, prompt.language);
      const id = uuid();

      addWritingAttempt({
        id,
        promptId: prompt.id,
        prompt: prompt.prompt,
        kannadaPrompt: prompt.kannadaPrompt,
        language: prompt.language,
        date: "Today",
        createdAt: new Date().toISOString(),
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
        ocrAccuracy: draft.ocrConfidence != null ? Math.round(draft.ocrConfidence * 100) : 0,
        aiFeedback: "",
        aiStatus: "pending",
        synced: false,
      });
      setWritingDraft(null);

      requestWritingAssessment(text, metrics, prompt.language, prompt.minWords)
        .then((assessment) =>
          updateWritingAttempt(id, {
            assessment,
            aiStatus: "completed",
            score: assessment.score,
            grammarScore: assessment.grammarScore,
            vocabularyScore: assessment.vocabularyScore,
            spellingScore: assessment.spellingScore,
            aiFeedback: assessment.summary,
          })
        )
        .catch(() => updateWritingAttempt(id, { aiStatus: "failed" }));

      return id;
    },
    [addWritingAttempt, updateWritingAttempt, setWritingDraft]
  );
}
