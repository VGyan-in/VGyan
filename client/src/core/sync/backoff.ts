export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_CAP_MS = 60 * 60_000;

/**
 * Exponential backoff with full jitter: 30 s base, ×2 per attempt, capped at 1 h.
 * `attempts` is the number of failed attempts so far (1 after the first failure).
 */
export function backoffDelayMs(attempts: number, random: () => number = Math.random): number {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
  // Keep at least half the delay so retries never bunch up immediately.
  return Math.round(exp / 2 + random() * (exp / 2));
}

export function nextRetryAt(attempts: number, now: Date, random?: () => number): string {
  return new Date(now.getTime() + backoffDelayMs(attempts, random)).toISOString();
}
