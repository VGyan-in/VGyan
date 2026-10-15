import type { MediaKind } from "./files";

// Web (development only): browsers have no app file system, so captured media
// keeps its blob/data URI for the current page session.

export async function persistMedia(
  sourceUri: string,
  _kind: MediaKind,
  _participantId: string,
  _sessionId: string,
  _attemptId: string
): Promise<string> {
  return sourceUri;
}

export function deleteMedia(_uri: string | null | undefined) {}

export function mediaUsage(_participantId: string): Record<MediaKind, { count: number; bytes: number }> {
  return { recordings: { count: 0, bytes: 0 }, images: { count: 0, bytes: 0 } };
}
