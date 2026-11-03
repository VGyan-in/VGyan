import { describe, expect, it } from "@jest/globals";
import { computeFluency, type AsrWord } from "@/features/reading/fluency";

const w = (word: string, start: number, end: number, conf = 0.95): AsrWord => ({ word, start, end, conf });

describe("computeFluency", () => {
  it("returns null without timestamps", () => {
    expect(computeFluency([])).toBeNull();
  });

  it("counts pauses at or above the threshold", () => {
    const m = computeFluency([w("the", 0, 0.3), w("boy", 0.4, 0.7), w("went", 1.5, 1.8), w("home", 1.85, 2.1)])!;
    expect(m.pauseCount).toBe(1);
    expect(m.totalPauseSec).toBe(0.8);
    expect(m.longestPauseSec).toBe(0.8);
  });

  it("detects immediate repetitions and fillers", () => {
    const m = computeFluency([w("the", 0, 0.2), w("the", 0.2, 0.4), w("um", 0.4, 0.6), w("boy", 0.6, 0.9)])!;
    expect(m.immediateRepetitions).toBe(1);
    expect(m.fillerCount).toBe(1);
  });

  it("does not treat passage words like 'so' as fillers", () => {
    expect(computeFluency([w("so", 0, 0.2), w("like", 0.2, 0.4)])!.fillerCount).toBe(0);
  });

  it("computes articulation rate from speaking time only", () => {
    // 3 words in 1.5 s of speech, with a 5 s pause in between.
    const m = computeFluency([w("a", 0, 0.5), w("b", 0.5, 1), w("c", 6, 6.5)])!;
    expect(m.articulationRate).toBe(120);
  });

  it("lists low-confidence words once, ignoring missing confidence", () => {
    const m = computeFluency([w("cat", 0, 0.2, 0.4), w("cat", 1, 1.2, 0.3), w("dog", 2, 2.2, -1)])!;
    expect(m.lowConfidenceWords).toEqual(["cat"]);
  });

  it("handles Kannada words", () => {
    const m = computeFluency([w("ನಮ್ಮ", 0, 0.4), w("ನಮ್ಮ", 0.4, 0.8), w("ಶಾಲೆ", 0.8, 1.2)])!;
    expect(m.immediateRepetitions).toBe(1);
  });
});
