/** RFC 4122 v4 UUID for client-generated attempt IDs (backend upserts on these). */
export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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

/** Display date for an attempt: live attempts carry createdAt, seed data a preformatted date. */
export function attemptDate(a: { createdAt?: string; date: string }): string {
  return a.createdAt ? formatAttemptDate(a.createdAt) : a.date;
}
