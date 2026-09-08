import { describe, expect, it } from "vitest";
import {
  differsOnlyByPunctuation,
  normalizeNarrationText,
} from "@/lib/domain/narration-normalization";

describe("normalizeNarrationText", () => {
  it("treats canonically equivalent accented text as identical", () => {
    const composed = "café";
    const decomposed = "cafe\u0301";
    expect(decomposed).not.toBe(composed);
    expect(normalizeNarrationText(decomposed)).toBe(
      normalizeNarrationText(composed),
    );
  });

  it("does not apply compatibility folding that would change what is written", () => {
    // NFKC would rewrite these; the policy uses NFC precisely so it cannot.
    expect(normalizeNarrationText("½")).toBe("½");
    expect(normalizeNarrationText("ﬁnance")).toBe("ﬁnance");
    expect(normalizeNarrationText("m²")).toBe("m²");
  });

  it("collapses layout whitespace including exotic spaces", () => {
    expect(normalizeNarrationText("Line one.\r\n\r\nLine two.")).toBe(
      "Line one. Line two.",
    );
    expect(normalizeNarrationText("a\u00a0b\u2009c\u3000d")).toBe("a b c d");
    expect(normalizeNarrationText("  padded  ")).toBe("padded");
    expect(normalizeNarrationText("tab\tseparated")).toBe("tab separated");
  });

  it("removes zero-width characters", () => {
    expect(normalizeNarrationText("in\u200bvest\ufeffing")).toBe("investing");
  });

  it("preserves case, punctuation and wording", () => {
    expect(normalizeNarrationText("It's a “quote” — really?")).toBe(
      "It's a “quote” — really?",
    );
    expect(normalizeNarrationText("Save 20%.")).not.toBe(
      normalizeNarrationText("Save twenty percent."),
    );
    expect(normalizeNarrationText("Rates rose.")).not.toBe(
      normalizeNarrationText("Rates fell."),
    );
  });

  it("is idempotent", () => {
    const once = normalizeNarrationText("  a\u200b\r\n b ");
    expect(normalizeNarrationText(once)).toBe(once);
  });
});

describe("differsOnlyByPunctuation", () => {
  it("detects typographic-only differences", () => {
    expect(
      differsOnlyByPunctuation("It's here — now.", "It’s here - now."),
    ).toBe(true);
  });

  it("does not treat a wording change as punctuation", () => {
    expect(differsOnlyByPunctuation("Rates rose.", "Rates fell.")).toBe(false);
  });

  it("returns false for identical text", () => {
    expect(differsOnlyByPunctuation("Same.", "Same.")).toBe(false);
  });

  it("does not report punctuation-only when a word is dropped", () => {
    expect(
      differsOnlyByPunctuation("Buy the index fund.", "Buy the fund."),
    ).toBe(false);
  });
});
