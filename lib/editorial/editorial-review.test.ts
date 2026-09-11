import { describe, expect, it } from "vitest";
import {
  describeEditorialReadiness,
  resolveEditorialSignoff,
  summarizeEditorialReview,
  type ReviewableClaim,
} from "@/lib/editorial/editorial-review";

const CLAIMS: ReviewableClaim[] = [
  { id: "a", quotedText: "The fund returned 8%.", reviewState: "supported" },
  { id: "b", quotedText: "Nobody lost money.", reviewState: "disputed" },
  { id: "c", quotedText: "It started in 1971.", reviewState: "unchecked" },
];

function signoff(overrides: Partial<Parameters<typeof resolveEditorialSignoff>[0]> = {}) {
  return resolveEditorialSignoff({
    signoff: {
      signedAt: new Date("2026-09-11T10:00:00Z"),
      coveredClaims: CLAIMS.map((claim) => ({
        id: claim.id,
        reviewState: claim.reviewState,
      })),
      scriptFingerprint: "the script",
    },
    claims: CLAIMS,
    staleClaimIds: [],
    scriptFingerprint: "the script",
    ...overrides,
  });
}

describe("summarizing a review", () => {
  it("counts each state separately and never collapses them into a score", () => {
    const summary = summarizeEditorialReview({
      claims: CLAIMS,
      staleClaimIds: ["c"],
    });
    expect(summary).toEqual({
      total: 3,
      supported: 1,
      disputed: 1,
      unchecked: 1,
      stale: 1,
    });
  });

  it("reports zeros for an empty review rather than nothing at all", () => {
    expect(
      summarizeEditorialReview({ claims: [], staleClaimIds: [] }),
    ).toMatchObject({ total: 0, unchecked: 0 });
  });
});

describe("a sign-off against the exact script", () => {
  it("is current", () => {
    expect(signoff()).toEqual({ status: "current", reasons: [] });
  });
});

describe("an edit that does not touch a reviewed sentence", () => {
  it("leaves the sign-off standing, but says the script has moved", () => {
    // The acceptance criterion turns on this: a material edit invalidates,
    // an immaterial one does not, and neither is silently treated as the
    // other.
    const resolved = signoff({ scriptFingerprint: "the script, plus an aside" });
    expect(resolved.status).toBe("edited");
    expect(resolved.reasons[0]).toContain("outside every reviewed sentence");
  });
});

describe("an edit to a reviewed sentence", () => {
  it("withdraws the sign-off and names the sentence", () => {
    const resolved = signoff({
      staleClaimIds: ["a"],
      scriptFingerprint: "the script, rewritten",
    });
    expect(resolved.status).toBe("invalidated");
    expect(resolved.reasons.join(" ")).toContain("The fund returned 8%.");
  });
});

describe("changes to the review itself", () => {
  it("withdraws the sign-off when a verdict changes", () => {
    const resolved = signoff({
      claims: [
        { ...CLAIMS[0]!, reviewState: "disputed" },
        CLAIMS[1]!,
        CLAIMS[2]!,
      ],
    });
    expect(resolved.status).toBe("invalidated");
    expect(resolved.reasons[0]).toContain("from supported to disputed");
  });

  it("withdraws the sign-off when a claim is added afterwards", () => {
    const resolved = signoff({
      claims: [
        ...CLAIMS,
        { id: "d", quotedText: "Rates doubled.", reviewState: "unchecked" },
      ],
    });
    expect(resolved.status).toBe("invalidated");
    expect(resolved.reasons[0]).toContain("added after sign-off");
  });

  it("withdraws the sign-off when a covered claim is removed", () => {
    const resolved = signoff({ claims: [CLAIMS[0]!, CLAIMS[1]!] });
    expect(resolved.status).toBe("invalidated");
    expect(resolved.reasons[0]).toContain("removed");
  });
});

describe("no sign-off at all", () => {
  it("is its own state, with no invented reasons", () => {
    expect(
      resolveEditorialSignoff({
        signoff: null,
        claims: CLAIMS,
        staleClaimIds: [],
        scriptFingerprint: "the script",
      }),
    ).toEqual({ status: "none", reasons: [] });
  });
});

describe("the line shown beside approval", () => {
  it("never claims anything was verified", () => {
    const text = describeEditorialReadiness(
      summarizeEditorialReview({ claims: CLAIMS, staleClaimIds: [] }),
    );
    expect(text).toContain("not that this app verified it");
    expect(text).toContain("1 disputed");
    expect(text).toContain("1 unchecked");
  });

  it("says plainly that an empty review checked nothing", () => {
    expect(
      describeEditorialReadiness(
        summarizeEditorialReview({ claims: [], staleClaimIds: [] }),
      ),
    ).toContain("does not check anything");
  });
});
