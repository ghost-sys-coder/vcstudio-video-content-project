import { describe, expect, it } from "vitest";
import {
  buildSceneNarrationInput,
  NarrationInputError,
} from "@/lib/audio/narration-input";

describe("buildSceneNarrationInput", () => {
  it("normalizes whitespace and counts characters", () => {
    const result = buildSceneNarrationInput({
      narrationText: "  Hello   world\n\nfrom  the scene.  ",
      maximumCharacters: 100,
    });
    expect(result.text).toBe("Hello world from the scene.");
    expect(result.characterCount).toBe("Hello world from the scene.".length);
  });

  it("rejects empty narration", () => {
    expect(() =>
      buildSceneNarrationInput({
        narrationText: "   \n  ",
        maximumCharacters: 100,
      }),
    ).toThrow(NarrationInputError);
  });

  it("rejects narration beyond the character limit", () => {
    expect(() =>
      buildSceneNarrationInput({
        narrationText: "abcdefghij",
        maximumCharacters: 5,
      }),
    ).toThrow(NarrationInputError);
  });

  it("rejects an invalid maximum", () => {
    expect(() =>
      buildSceneNarrationInput({ narrationText: "hi", maximumCharacters: 0 }),
    ).toThrow(RangeError);
  });
});
