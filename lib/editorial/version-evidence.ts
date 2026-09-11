/**
 * The shape of the review record frozen onto an approved script version.
 *
 * It is a self-contained copy, not a set of foreign keys. Citations point at
 * sources that a person can archive, retitle or correct afterwards, and a
 * record that followed those pointers would quietly change what it said an
 * approval was based on. Reading an old approval has to return the claims, the
 * verdicts and the source details exactly as they stood, even when every one of
 * those rows has since moved on.
 *
 * `policyVersion` travels with it because the meaning of "still anchored"
 * depends on the normalization policy in force. If that policy is ever
 * loosened, an old record must not be re-judged under the new one.
 */

import { NARRATION_NORMALIZATION_POLICY_VERSION } from "@/lib/domain/narration-normalization";
import type {
  ClaimReviewState,
  ClaimSourceStance,
} from "@/lib/editorial/editorial-review";

export const SCRIPT_EVIDENCE_RECORD_VERSION = "script-evidence-v1";

export interface EvidenceCitation {
  sourceId: string;
  stance: ClaimSourceStance;
  title: string;
  url: string | null;
  host: string | null;
  excerpt: string;
}

export interface EvidenceClaim {
  claimId: string;
  quotedText: string;
  reviewState: ClaimReviewState;
  reviewNote: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  citations: EvidenceCitation[];
}

export interface ScriptVersionEvidenceRecord {
  recordVersion: string;
  normalizationPolicyVersion: string;
  claims: EvidenceClaim[];
}

/** An empty record: nothing was reviewed, stated rather than left absent. */
export function emptyEvidenceRecord(): ScriptVersionEvidenceRecord {
  return {
    recordVersion: SCRIPT_EVIDENCE_RECORD_VERSION,
    normalizationPolicyVersion: NARRATION_NORMALIZATION_POLICY_VERSION,
    claims: [],
  };
}

/** Counts taken from a frozen record, so a summary never re-reads live rows. */
export function countEvidenceRecord(record: ScriptVersionEvidenceRecord): {
  claimCount: number;
  supportedCount: number;
  disputedCount: number;
  uncheckedCount: number;
} {
  let supportedCount = 0;
  let disputedCount = 0;
  let uncheckedCount = 0;
  for (const claim of record.claims) {
    if (claim.reviewState === "supported") supportedCount += 1;
    else if (claim.reviewState === "disputed") disputedCount += 1;
    else uncheckedCount += 1;
  }
  return {
    claimCount: record.claims.length,
    supportedCount,
    disputedCount,
    uncheckedCount,
  };
}
