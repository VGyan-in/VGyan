const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${(h % 12 || 12).toString().padStart(2, "0")}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** "Today, 11:30 AM" / "Yesterday" / "05 Oct", matching the seed data style. */
export function formatAttemptDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return `Today, ${formatTime(d)}`;
  if (d.getTime() >= startOfToday - 86400000) return "Yesterday";
  return `${d.getDate().toString().padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export function attemptDate(a: { createdAt: string }): string {
  return formatAttemptDate(a.createdAt);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Today at 02:45 PM", or "05 Oct, 02:45 PM". */
export function formatSyncTime(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? `Today at ${formatTime(d)}`
    : `${d.getDate().toString().padStart(2, "0")} ${MONTHS[d.getMonth()]}, ${formatTime(d)}`;
}

/** Consecutive days with at least one attempt, counting back from today (or yesterday). */
export function computeStreak(isoDates: string[], now = new Date()): number {
  const days = new Set(isoDates.map((iso) => new Date(iso).toDateString()));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Compact day label for charts: "Today", "Yday", or "05 Oct". */
export function shortDate(iso: string, lang: "en" | "kn" = "en", now = new Date()): string {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return lang === "en" ? "Today" : "ಇಂದು";
  if (d.getTime() >= startOfToday - 86400000) return lang === "en" ? "Yday" : "ನಿನ್ನೆ";
  return `${d.getDate().toString().padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}
