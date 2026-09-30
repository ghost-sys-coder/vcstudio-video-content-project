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

  it("keeps pause markers in the text but neither speaks nor bills them", () => {
    const result = buildSceneNarrationInput({
      narrationText: "On time. [PAUSE: 0.5s] Yet poorer.",
      maximumCharacters: 100,
    });
    expect(result.text).toBe("On time. [PAUSE: 0.5s] Yet poorer.");
    expect(result.characterCount).toBe(
      "On time.".length + "Yet poorer.".length,
    );
    expect(result.parts).toEqual([
      { kind: "speech", text: "On time." },
      { kind: "pause", milliseconds: 500 },
      { kind: "speech", text: "Yet poorer." },
    ]);
  });

  it("rejects narration that is only pauses", () => {
    expect(() =>
      buildSceneNarrationInput({
        narrationText: "[PAUSE: 1s]",
        maximumCharacters: 100,
      }),
    ).toThrow(NarrationInputError);
  });

  it("rejects an invalid maximum", () => {
    expect(() =>
      buildSceneNarrationInput({ narrationText: "hi", maximumCharacters: 0 }),
    ).toThrow(RangeError);
  });
});
