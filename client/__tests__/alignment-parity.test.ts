import { describe, expect, it } from "@jest/globals";
import { analyzeReading } from "@/features/reading/analyzer";
import fixtures from "../../shared/alignment-fixtures.json";

// The same fixtures run in backend/tests/test_analysis.py, so the phone and the server can never
// disagree about how a reading is scored.
describe("alignment parity with the server", () => {
  it.each(fixtures.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const r = analyzeReading(c.reference, c.transcript, c.durationMs, "English");
    expect(r.words.map((w) => w.status)).toEqual(c.statuses);
    expect(r.accuracy).toBe(c.accuracy);
    expect(r.wpm).toBe(c.wpm);
  });
});
