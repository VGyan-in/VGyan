import { Directory, File, Paths } from "expo-file-system";

export type MediaKind = "recordings" | "images";

/**
 * Moves a captured file (recorder/picker output) into permanent app storage:
 *   {document}/{kind}/{participantId}/{sessionId}/{attemptId}.{ext}
 * Paths use participant IDs, never names. Returns the new URI, or the original
 * URI if the move fails (the attempt is still saved; nothing is lost).
 */
export async function persistMedia(
  sourceUri: string,
  kind: MediaKind,
  participantId: string,
  sessionId: string,
  attemptId: string
): Promise<string> {
  try {
    const dir = new Directory(Paths.document, kind, participantId, sessionId);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const ext = extensionOf(sourceUri) ?? (kind === "recordings" ? "m4a" : "jpg");
    const target = new File(dir, `${attemptId}.${ext}`);
    if (target.exists) target.delete();
    // Move rather than copy so the recorder/picker output isn't left behind as a duplicate.
    const source = new File(sourceUri);
    await source.move(target);
    return source.uri;
  } catch (e) {
    console.warn("persistMedia failed; keeping original file", e);
    return sourceUri;
  }
}

export function deleteMedia(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn("deleteMedia failed", e);
  }
}

/** Total size in bytes of a participant's stored media, by kind. */
export function mediaUsage(participantId: string): Record<MediaKind, { count: number; bytes: number }> {
  const out = { recordings: { count: 0, bytes: 0 }, images: { count: 0, bytes: 0 } };
  for (const kind of ["recordings", "images"] as const) {
    try {
      const root = new Directory(Paths.document, kind, participantId);
      if (!root.exists) continue;
      const walk = (dir: Directory) => {
        for (const entry of dir.list()) {
          if (entry instanceof Directory) walk(entry);
          else {
            out[kind].count += 1;
            out[kind].bytes += entry.size ?? 0;
          }
        }
      };
      walk(root);
    } catch {
      // Usage is informational only.
    }
  }
  return out;
}

function extensionOf(uri: string): string | null {
  const m = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(uri);
  return m ? m[1].toLowerCase() : null;
}
