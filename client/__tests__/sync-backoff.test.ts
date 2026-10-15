import { describe, expect, it } from "@jest/globals";
import { BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoffDelayMs } from "@/core/sync/backoff";

describe("backoffDelayMs", () => {
  it("starts around the 30 s base", () => {
    expect(backoffDelayMs(1, () => 0)).toBe(BACKOFF_BASE_MS / 2);
    expect(backoffDelayMs(1, () => 1)).toBe(BACKOFF_BASE_MS);
  });

  it("doubles each attempt", () => {
    expect(backoffDelayMs(3, () => 1)).toBe(BACKOFF_BASE_MS * 4);
  });

  it("caps at one hour", () => {
    expect(backoffDelayMs(50, () => 1)).toBe(BACKOFF_CAP_MS);
  });
});
