import { getJson } from "@/core/api/client";
import { isServerConfigured } from "@/core/config";
import type { Repository } from "@/core/db/types";
import { PASSAGES, WRITING_PROMPTS, type AssessmentLanguage, type Level, type Passage, type WritingPrompt } from "@/constants/content";

const META_KEY = "content.assignments";

/** Shape of GET /student/assignments (backend/app/api/student.py). */
interface RemotePassage {
  id: string;
  kind: "reading" | "writing";
  language: AssessmentLanguage;
  level: Level | null;
  title: string;
  kannadaTitle: string;
  text: string;
  kannadaText: string;
  minWords: number | null;
  hint: string;
  kannadaHint: string;
  isActive: boolean;
  assigned: boolean;
  version: number;
}

const bundledPassageIds = new Set(PASSAGES.map((p) => p.id));
const bundledPromptIds = new Set(WRITING_PROMPTS.map((p) => p.id));

/**
 * Merges server-managed passages and prompts into the in-memory lists the screens read. Bundled
 * content stays available offline; a server copy with the same ID replaces it (teachers' edits win),
 * and passages assigned to the student's class are listed first.
 */
export function applyRemoteContent(items: RemotePassage[]) {
  const active = items.filter((i) => i.isActive);
  const reading: Passage[] = active
    .filter((i) => i.kind === "reading" && i.level)
    .map((i) => ({ id: i.id, language: i.language, level: i.level as Level, title: i.title, kannadaTitle: i.kannadaTitle, text: i.text }));
  const writing: WritingPrompt[] = active
    .filter((i) => i.kind === "writing")
    .map((i) => ({
      id: i.id,
      language: i.language,
      prompt: i.text,
      kannadaPrompt: i.kannadaText || i.kannadaTitle,
      minWords: i.minWords ?? 40,
      hint: i.hint,
      kannadaHint: i.kannadaHint,
    }));
  const assigned = new Set(active.filter((i) => i.assigned).map((i) => i.id));
  const order = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => Number(assigned.has(b.id)) - Number(assigned.has(a.id)));

  const mergedPassages = order([...reading, ...PASSAGES.filter((p) => bundledPassageIds.has(p.id) && !reading.some((r) => r.id === p.id))]);
  const mergedPrompts = order([...writing, ...WRITING_PROMPTS.filter((p) => bundledPromptIds.has(p.id) && !writing.some((w) => w.id === p.id))]);
  PASSAGES.splice(0, PASSAGES.length, ...mergedPassages);
  WRITING_PROMPTS.splice(0, WRITING_PROMPTS.length, ...mergedPrompts);
}

/** Loads the last cached copy (works offline). */
export async function loadCachedContent(repo: Repository) {
  try {
    const raw = await repo.getMeta(META_KEY);
    if (raw) applyRemoteContent(JSON.parse(raw) as RemotePassage[]);
  } catch {
    // A corrupt cache must never block the app; bundled content remains.
  }
}

/** Fetches the latest content when online and caches it for offline use. */
export async function refreshContent(repo: Repository): Promise<boolean> {
  if (!isServerConfigured()) return false;
  try {
    const res = await getJson<{ passages: RemotePassage[] }>("/student/assignments");
    if (!Array.isArray(res.passages)) return false;
    await repo.setMeta(META_KEY, JSON.stringify(res.passages));
    applyRemoteContent(res.passages);
    return true;
  } catch {
    return false;
  }
}
