import { describe, expect, it } from "vitest";
import {
  CLAIM_CANDIDATE_GUIDANCE,
  describeClaimSignals,
  findClaimCandidates,
} from "@/lib/editorial/claim-candidates";

describe("what gets suggested", () => {
  it("flags a percentage, an amount and a year", () => {
    const found = findClaimCandidates(
      "Inflation hit 9% in 2022. The average household lost $4,000. It felt worse.",
    );
    expect(found).toHaveLength(2);
    expect(found[0]?.signals).toContain("percentage");
    expect(found[0]?.signals).toContain("date");
    expect(found[1]?.signals).toContain("money");
  });

  it("flags an appeal to a source with no figure in it", () => {
    const found = findClaimCandidates(
      "According to the Federal Reserve, this never happens.",
    );
    expect(found[0]?.signals).toContain("attribution");
  });

  it("flags a superlative, which is checkable even without a number", () => {
    const found = findClaimCandidates("This is the largest fund in the world.");
    expect(found[0]?.signals).toEqual(["superlative"]);
  });

  it("leaves ordinary prose alone", () => {
    expect(
      findClaimCandidates("Let me show you how I think about this."),
    ).toEqual([]);
  });

  it("reports a bare figure only when nothing more specific explains it", () => {
    const bare = findClaimCandidates("There were 3 of them.");
    expect(bare[0]?.signals).toEqual(["figure"]);
  });
});

describe("offsets", () => {
  it("point at the sentence in the original text, not a normalized copy", () => {
    const content = "A plain opener.\n\nInflation hit 9% in 2022.";
    const found = findClaimCandidates(content);
    expect(content.slice(found[0]?.offset ?? -1)).toBe(
      "Inflation hit 9% in 2022.",
    );
  });

  it("separate two sentences that repeat the same words", () => {
    const found = findClaimCandidates("It rose 3%. It rose 3%.");
    expect(found).toHaveLength(2);
    expect(found[0]?.offset).not.toBe(found[1]?.offset);
  });
});

describe("honesty about what this is", () => {
  it("says in the guidance that nothing was verified", () => {
    expect(CLAIM_CANDIDATE_GUIDANCE).toContain("not a check");
    expect(CLAIM_CANDIDATE_GUIDANCE).toContain("nothing here has been verified");
  });

  it("finds nothing in a non-English claim, which must never read as a pass", () => {
    // Documented limitation rather than a silent one: the word cues are
    // English. A figure still fires, so this is a weaker hint, never a
    // stronger assurance.
    expect(findClaimCandidates("Das ist die größte Bank der Welt.")).toEqual([]);
    expect(findClaimCandidates("Die Inflation lag 2022 bei 9%.")).toHaveLength(
      1,
    );
  });
});

describe("describeClaimSignals", () => {
  it("reads as a sentence for one, two and three signals", () => {
    expect(describeClaimSignals(["money"])).toBe("Contains an amount of money.");
    expect(describeClaimSignals(["percentage", "date"])).toBe(
      "Contains a percentage and a date.",
    );
    expect(describeClaimSignals(["percentage", "date", "superlative"])).toBe(
      "Contains a percentage, a date and a superlative.",
    );
  });

  it("returns nothing for no signals", () => {
    expect(describeClaimSignals([])).toBe("");
  });
});
