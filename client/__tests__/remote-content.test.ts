import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/core/storage/secure", () => ({ secureStore: { get: jest.fn(async () => null), set: jest.fn(), remove: jest.fn() } }));

const item = (over: Record<string, unknown>) => ({
  kind: "reading",
  language: "English",
  level: "Easy",
  title: "",
  kannadaTitle: "",
  text: "",
  kannadaText: "",
  minWords: null,
  hint: "",
  kannadaHint: "",
  isActive: true,
  assigned: false,
  version: 1,
  ...over,
});

describe("server passages", () => {
  it("adds teacher passages, lets edits override bundled ones, lists assigned first, and survives a reload from cache", async () => {
    let content!: typeof import("@/constants/content");
    let remote!: typeof import("@/features/content/remote-content");
    let mem!: typeof import("@/core/db/memory-repository");
    jest.isolateModules(() => {
      content = require("@/constants/content");
      remote = require("@/features/content/remote-content");
      mem = require("@/core/db/memory-repository");
    });
    const bundled = content.PASSAGES.length;
    const items = [
      item({ id: "P-EN-E1", title: "My Pet Cat", text: "Edited by the teacher." }),
      item({ id: "P-EN-E9", title: "Rain", text: "It is raining.", assigned: true }),
      item({ id: "P-OLD", title: "Hidden", text: "x", isActive: false }),
      item({ id: "W-KN-9", kind: "writing", language: "Kannada", level: null, text: "Prompt", kannadaText: "ಪ್ರಶ್ನೆ", minWords: 30 }),
    ];
    remote.applyRemoteContent(items as never);
    expect(content.PASSAGES[0].id).toBe("P-EN-E9");
    expect(content.PASSAGES).toHaveLength(bundled + 1);
    expect(content.getPassage("P-EN-E1")?.text).toBe("Edited by the teacher.");
    expect(content.getPassage("P-OLD")).toBeUndefined();
    expect(content.getWritingPrompt("W-KN-9")).toMatchObject({ kannadaPrompt: "ಪ್ರಶ್ನೆ", minWords: 30 });

    const repo = mem.createMemoryRepository();
    await repo.setMeta("content.assignments", "{corrupt");
    await expect(remote.loadCachedContent(repo)).resolves.toBeUndefined(); // never blocks start-up
  });
});
