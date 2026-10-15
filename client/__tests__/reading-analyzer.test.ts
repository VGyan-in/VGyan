import { describe, expect, it } from "@jest/globals";
import {
  alignWords,
  analyzeReading,
  computeAccuracy,
  computePace,
  computeWpm,
  normalizeWord,
  selectPracticeWords,
  tokenize,
} from "@/features/reading/analyzer";

const statuses = (ref: string, hyp: string) =>
  alignWords(tokenize(ref), tokenize(hyp)).map((w) => w.status);

describe("normalizeWord", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeWord("School.")).toBe("school");
    expect(normalizeWord("don't")).toBe("dont");
  });

  it("removes zero-width joiners in Kannada", () => {
    expect(normalizeWord("ಶಾಲೆ‌")).toBe("ಶಾಲೆ");
  });

  it("keeps Kannada vowel signs", () => {
    expect(normalizeWord("ಸುಂದರವಾಗಿದೆ.")).toBe("ಸುಂದರವಾಗಿದೆ");
  });
});

describe("alignWords", () => {
  it("matches the README fixture: one substitution, four correct", () => {
    const r = analyzeReading("The boy went to school.", "The boy go to school", 60000, "English");
    expect(r.words.map((w) => w.status)).toEqual([
      "correct",
      "correct",
      "substitution",
      "correct",
      "correct",
    ]);
    expect(r.words[2]).toMatchObject({ ref: "went", hyp: "go" });
    expect(r.substitutions).toBe(1);
    expect(r.correct).toBe(4);
  });

  it("reports a skipped word as an omission", () => {
    expect(statuses("a b c d", "a c d")).toEqual(["correct", "omission", "correct", "correct"]);
  });

  it("reports an extra word as an insertion", () => {
    expect(statuses("a b c", "a x b c")).toEqual(["correct", "insertion", "correct", "correct"]);
  });

  it("handles an empty transcript as all omissions", () => {
    expect(statuses("one two", "")).toEqual(["omission", "omission"]);
  });

  it("matches words early when the reader stops partway", () => {
    // "crow" appears twice; the reader stopped after the first one.
    expect(statuses("a thirsty crow flew far and the clever crow drank", "a thirsty crow")).toEqual([
      "correct",
      "correct",
      "correct",
      "omission",
      "omission",
      "omission",
      "omission",
      "omission",
      "omission",
      "omission",
    ]);
  });

  it("reports a misread final word as a substitution, not a skip", () => {
    expect(statuses("a b c", "a x")).toEqual(["correct", "substitution", "omission"]);
  });

  it("aligns Kannada text", () => {
    expect(statuses("ನನ್ನ ಶಾಲೆ ತುಂಬಾ ಸುಂದರವಾಗಿದೆ.", "ನನ್ನ ಶಾಲೆ ಸುಂದರವಾಗಿದೆ")).toEqual([
      "correct",
      "correct",
      "omission",
      "correct",
    ]);
  });
});

describe("metrics", () => {
  it("computes accuracy against reference words", () => {
    expect(computeAccuracy(4, 5)).toBe(80);
    expect(computeAccuracy(0, 0)).toBe(0);
  });

  it("computes words per minute", () => {
    expect(computeWpm(50, 30000)).toBe(100);
    expect(computeWpm(10, 0)).toBe(0);
  });

  it("uses lower pace bands for Kannada", () => {
    expect(computePace(80, "Kannada")).toBe("Fluent");
    expect(computePace(80, "English")).toBe("Steady");
    expect(computePace(30, "Kannada")).toBe("Slow");
  });

  it("selects unique practice words from substitutions and omissions", () => {
    const words = alignWords(tokenize("The cat sat. The cat ran."), tokenize("The cot sat. The cot"));
    expect(selectPracticeWords(words)).toEqual(["cat", "ran"]);
  });

  it("counts every mistake type", () => {
    const r = analyzeReading("a b c d", "a x c d e", 60000, "English");
    expect(r.mistakes).toBe(r.substitutions + r.omissions + r.insertions);
    expect(r.accuracy).toBe(75);
  });
});
