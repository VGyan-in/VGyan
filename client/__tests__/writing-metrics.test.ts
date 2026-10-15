import { describe, expect, it } from "@jest/globals";
import { computeWritingMetrics, countSentences, countWords } from "@/features/writing/metrics";

describe("writing metrics", () => {
  it("counts words and sentences in English", () => {
    const text = "I like Deepavali. We light diyas! Do you?";
    expect(countWords(text)).toBe(8);
    expect(countSentences(text)).toBe(3);
  });

  it("treats the danda as a sentence end", () => {
    expect(countSentences("ನಾನು ಶಾಲೆಗೆ ಹೋಗುತ್ತೇನೆ। ನನಗೆ ಓದುವುದು ಇಷ್ಟ.")).toBe(2);
  });

  it("ignores stray punctuation as words", () => {
    expect(countWords("Hello , world - !")).toBe(2);
  });

  it("is safe on empty text", () => {
    expect(computeWritingMetrics("", "English")).toEqual({
      wordCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      uniqueWordRatio: 0,
      longWordCount: 0,
    });
  });

  it("measures vocabulary diversity", () => {
    expect(computeWritingMetrics("the the the the", "English").uniqueWordRatio).toBe(0.25);
  });
});
