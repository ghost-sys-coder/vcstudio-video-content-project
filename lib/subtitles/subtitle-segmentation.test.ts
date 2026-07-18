import { describe, expect, it } from "vitest";
import {
  chunkByLength,
  splitIntoSentences,
  wrapCaptionLines,
} from "@/lib/subtitles/subtitle-segmentation";

describe("splitIntoSentences", () => {
  it("splits prose on terminal punctuation and keeps it", () => {
    expect(splitIntoSentences("Hello world. Foo bar! Done?")).toEqual([
      "Hello world.",
      "Foo bar!",
      "Done?",
    ]);
  });

  it("keeps an ellipsis with its sentence", () => {
    expect(splitIntoSentences("Wait... really?")).toEqual([
      "Wait...",
      "really?",
    ]);
  });

  it("returns a single sentence when there is no terminal punctuation", () => {
    expect(splitIntoSentences("no punctuation here")).toEqual([
      "no punctuation here",
    ]);
  });

  it("normalizes whitespace and ignores empty input", () => {
    expect(splitIntoSentences("  Spaced   out.  ")).toEqual(["Spaced out."]);
    expect(splitIntoSentences("   ")).toEqual([]);
  });
});

describe("chunkByLength", () => {
  it("wraps at word boundaries within the limit", () => {
    expect(chunkByLength("one two three four", 8)).toEqual([
      "one two",
      "three",
      "four",
    ]);
  });

  it("keeps a single over-long word intact", () => {
    expect(chunkByLength("supercalifragilistic tiny", 10)).toEqual([
      "supercalifragilistic",
      "tiny",
    ]);
  });
});

describe("wrapCaptionLines", () => {
  it("joins wrapped chunks with newlines", () => {
    expect(wrapCaptionLines("one two three", 7)).toBe("one two\nthree");
  });
});
