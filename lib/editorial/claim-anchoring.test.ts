import { describe, expect, it } from "vitest";
import {
  anchorClaims,
  isClaimAnchored,
  locateClaimQuote,
} from "@/lib/editorial/claim-anchoring";

const SCRIPT = [
  "Most people never check this.",
  "The fund returned 8% last year.",
  "That is the whole trick.",
].join(" ");

describe("an unchanged sentence", () => {
  it("still anchors", () => {
    expect(
      isClaimAnchored({
        scriptContent: SCRIPT,
        quotedText: "The fund returned 8% last year.",
      }),
    ).toBe(true);
  });

  it("anchors through a rewrapped line, because layout is not content", () => {
    expect(
      isClaimAnchored({
        scriptContent: "The fund returned\r\n  8% last year.",
        quotedText: "The fund returned 8% last year.",
      }),
    ).toBe(true);
  });

  it("anchors through a zero-width character an editor inserted", () => {
    expect(
      isClaimAnchored({
        scriptContent: "The fund returned 8​% last year.",
        quotedText: "The fund returned 8% last year.",
      }),
    ).toBe(true);
  });
});

describe("a changed sentence", () => {
  it("stops anchoring when a single digit changes", () => {
    // The whole point. 8% and 18% are one character apart and are not the
    // same claim; a tolerant matcher would launder the new figure through the
    // old review.
    expect(
      isClaimAnchored({
        scriptContent: "The fund returned 18% last year.",
        quotedText: "The fund returned 8% last year.",
      }),
    ).toBe(false);
  });

  it("stops anchoring when the punctuation changes", () => {
    expect(
      isClaimAnchored({
        scriptContent: "The fund returned 8% last year!",
        quotedText: "The fund returned 8% last year.",
      }),
    ).toBe(false);
  });

  it("stops anchoring when the case changes", () => {
    expect(
      isClaimAnchored({
        scriptContent: "the fund returned 8% last year.",
        quotedText: "The fund returned 8% last year.",
      }),
    ).toBe(false);
  });

  it("stops anchoring when the sentence is deleted entirely", () => {
    expect(
      isClaimAnchored({
        scriptContent: "Most people never check this.",
        quotedText: "The fund returned 8% last year.",
      }),
    ).toBe(false);
  });
});

describe("an empty quote", () => {
  it("never anchors, rather than matching at the start of every script", () => {
    expect(locateClaimQuote({ scriptContent: SCRIPT, quotedText: "" })).toBe(
      null,
    );
    expect(
      locateClaimQuote({ scriptContent: SCRIPT, quotedText: "   \n  " }),
    ).toBe(null);
  });
});

describe("ordering", () => {
  it("puts claims in reading order and stale ones last", () => {
    const anchored = anchorClaims({
      scriptContent: SCRIPT,
      claims: [
        { quotedText: "That is the whole trick." },
        { quotedText: "A sentence that was cut." },
        { quotedText: "Most people never check this." },
      ],
    });
    expect(anchored.map((entry) => entry.claim.quotedText)).toEqual([
      "Most people never check this.",
      "That is the whole trick.",
      "A sentence that was cut.",
    ]);
    expect(anchored[2]?.anchored).toBe(false);
  });

  it("keeps a stale claim in the list rather than dropping it", () => {
    // An invalidated review must get louder, not shorter.
    const anchored = anchorClaims({
      scriptContent: "",
      claims: [{ quotedText: "The fund returned 8% last year." }],
    });
    expect(anchored).toHaveLength(1);
    expect(anchored[0]?.anchored).toBe(false);
  });
});
