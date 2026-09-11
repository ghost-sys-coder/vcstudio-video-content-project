import { describe, expect, it } from "vitest";
import { NARRATION_NORMALIZATION_POLICY_VERSION } from "@/lib/domain/narration-normalization";
import {
  countEvidenceRecord,
  emptyEvidenceRecord,
  SCRIPT_EVIDENCE_RECORD_VERSION,
  type ScriptVersionEvidenceRecord,
} from "@/lib/editorial/version-evidence";

function record(
  states: ("supported" | "disputed" | "unchecked")[],
): ScriptVersionEvidenceRecord {
  return {
    recordVersion: SCRIPT_EVIDENCE_RECORD_VERSION,
    normalizationPolicyVersion: NARRATION_NORMALIZATION_POLICY_VERSION,
    claims: states.map((reviewState, index) => ({
      claimId: `claim-${index}`,
      quotedText: `Sentence ${index}.`,
      reviewState,
      reviewNote: "",
      reviewedByUserId: reviewState === "unchecked" ? null : "user-1",
      reviewedAt: reviewState === "unchecked" ? null : "2026-09-11T10:00:00Z",
      citations: [],
    })),
  };
}

describe("an empty record", () => {
  it("states that nothing was reviewed rather than being absent", () => {
    const empty = emptyEvidenceRecord();
    expect(empty.claims).toEqual([]);
    expect(countEvidenceRecord(empty)).toEqual({
      claimCount: 0,
      supportedCount: 0,
      disputedCount: 0,
      uncheckedCount: 0,
    });
  });

  it("carries the normalization policy it was written under", () => {
    // If that policy is ever loosened, an old record must not be re-judged
    // under the new one.
    expect(emptyEvidenceRecord().normalizationPolicyVersion).toBe(
      NARRATION_NORMALIZATION_POLICY_VERSION,
    );
  });
});

describe("counting a frozen record", () => {
  it("splits the three states and always sums to the total", () => {
    const counts = countEvidenceRecord(
      record(["supported", "supported", "disputed", "unchecked"]),
    );
    expect(counts).toEqual({
      claimCount: 4,
      supportedCount: 2,
      disputedCount: 1,
      uncheckedCount: 1,
    });
    expect(
      counts.supportedCount + counts.disputedCount + counts.uncheckedCount,
    ).toBe(counts.claimCount);
  });
});
