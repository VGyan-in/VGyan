import { describe, expect, it } from "@jest/globals";
import { diffWords } from "@/features/writing/diff";

describe("diffWords", () => {
  it("returns one unchanged part for identical text", () => {
    expect(diffWords("I like my school", "I  like my\nschool")).toEqual([{ kind: "same", text: "I like my school" }]);
  });

  it("marks a replaced word as removed then added", () => {
    expect(diffWords("He go to school", "He goes to school")).toEqual([
      { kind: "same", text: "He" },
      { kind: "removed", text: "go" },
      { kind: "added", text: "goes" },
      { kind: "same", text: "to school" },
    ]);
  });

  it("handles inserted and deleted words", () => {
    expect(diffWords("I went park", "I went to the park")).toEqual([
      { kind: "same", text: "I went" },
      { kind: "added", text: "to the" },
      { kind: "same", text: "park" },
    ]);
    expect(diffWords("the the cat", "the cat")).toEqual([
      { kind: "same", text: "the" },
      { kind: "removed", text: "the" },
      { kind: "same", text: "cat" },
    ]);
  });

  it("handles empty input", () => {
    expect(diffWords("", "")).toEqual([]);
    expect(diffWords("", "Hello")).toEqual([{ kind: "added", text: "Hello" }]);
  });

  it("works on Kannada words", () => {
    expect(diffWords("ನಮ್ಮ ಶಾಲೆ ದೊಡ್ಡದು", "ನಮ್ಮ ಶಾಲೆ ತುಂಬಾ ದೊಡ್ಡದು")).toEqual([
      { kind: "same", text: "ನಮ್ಮ ಶಾಲೆ" },
      { kind: "added", text: "ತುಂಬಾ" },
      { kind: "same", text: "ದೊಡ್ಡದು" },
    ]);
  });
});
