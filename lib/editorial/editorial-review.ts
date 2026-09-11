/**
 * What an editorial review says about a script, and whether it still holds.
 *
 * Three states and no fourth. A claim is `supported` when someone attached a
 * source and said it holds, `disputed` when someone attached a source and said
 * it does not, and `unchecked` until then. There is deliberately no "probably
 * fine" and no aggregate score: a score invites reading 80% as a pass, when the
 * only number that matters before publishing is how many claims nobody looked
 * at.
 *
 * `unchecked` is also the default, and nothing in this module ever moves a
 * claim out of it. Only a person does.
 */

export type ClaimReviewState = "unchecked" | "supported" | "disputed";

/** Whether an attached source backs a claim up or contradicts it. */
export type ClaimSourceStance = "supports" | "disputes";

export interface ReviewableClaim {
  id: string;
  quotedText: string;
  reviewState: ClaimReviewState;
}

export interface EditorialReviewSummary {
  total: number;
  supported: number;
  disputed: number;
  unchecked: number;
  /** Claims whose quoted text is no longer in the script. */
  stale: number;
}

export interface EditorialSignoffRecord {
  signedAt: Date;
  /** Claim id and the state it carried when the sign-off was made. */
  coveredClaims: readonly { id: string; reviewState: ClaimReviewState }[];
  /** The normalized script text the sign-off was made against. */
  scriptFingerprint: string;
}

export type EditorialSignoffStatus =
  "none" | "current" | "edited" | "invalidated";

export interface ResolvedEditorialSignoff {
  status: EditorialSignoffStatus;
  /** Every concrete reason, in the order they were found. Never invented. */
  reasons: string[];
}

/** Counts by state, plus how many reviews the script has outgrown. */
export function summarizeEditorialReview(input: {
  claims: readonly ReviewableClaim[];
  staleClaimIds: readonly string[];
}): EditorialReviewSummary {
  const stale = new Set(input.staleClaimIds);
  const summary: EditorialReviewSummary = {
    total: input.claims.length,
    supported: 0,
    disputed: 0,
    unchecked: 0,
    stale: 0,
  };
  for (const claim of input.claims) {
    summary[claim.reviewState] += 1;
    if (stale.has(claim.id)) summary.stale += 1;
  }
  return summary;
}

/**
 * Whether a sign-off still describes the script and the review in front of you.
 *
 * The distinction that carries the acceptance criterion is between `edited` and
 * `invalidated`. Rewriting a sentence nobody reviewed is an edit: the claims
 * that were checked are still there, still say the same thing, and the person
 * who signed off would sign off again. Changing the wording of a *reviewed*
 * claim, changing a verdict, or adding or removing a claim means the sign-off
 * covers something that no longer exists, and it is withdrawn.
 *
 * `edited` is not a pass. It says the sign-off stands for what it covered and
 * that the script has moved since, so a new claim may be sitting in it
 * unreviewed. Only a fingerprint match earns `current`.
 */
export function resolveEditorialSignoff(input: {
  signoff: EditorialSignoffRecord | null;
  claims: readonly ReviewableClaim[];
  staleClaimIds: readonly string[];
  scriptFingerprint: string;
}): ResolvedEditorialSignoff {
  if (!input.signoff) return { status: "none", reasons: [] };
  const reasons: string[] = [];
  const stale = new Set(input.staleClaimIds);
  const covered = new Map(
    input.signoff.coveredClaims.map((claim) => [claim.id, claim.reviewState]),
  );
  const present = new Set(input.claims.map((claim) => claim.id));

  for (const claim of input.claims) {
    const signedState = covered.get(claim.id);
    if (signedState === undefined) {
      reasons.push(`A claim was added after sign-off: “${claim.quotedText}”.`);
      continue;
    }
    if (signedState !== claim.reviewState)
      reasons.push(
        `A verdict changed after sign-off, from ${signedState} to ${claim.reviewState}: “${claim.quotedText}”.`,
      );
    if (stale.has(claim.id))
      reasons.push(
        `A reviewed sentence was edited after sign-off: “${claim.quotedText}”.`,
      );
  }
  for (const [id] of covered)
    if (!present.has(id))
      reasons.push("A claim covered by the sign-off was removed.");

  if (reasons.length > 0) return { status: "invalidated", reasons };
  if (input.signoff.scriptFingerprint !== input.scriptFingerprint)
    return {
      status: "edited",
      reasons: [
        "The script has been edited since sign-off, outside every reviewed sentence. The sign-off still covers those claims; check whether the new text added any.",
      ],
    };
  return { status: "current", reasons: [] };
}

/**
 * The one line to put beside an approval control.
 *
 * It never says a script is accurate, because nothing in this application can
 * know that. It says what was and was not looked at.
 */
export function describeEditorialReadiness(
  summary: EditorialReviewSummary,
): string {
  if (summary.total === 0)
    return "No claims have been marked for review. Approving does not check anything.";
  const parts = [`${summary.supported} supported`];
  if (summary.disputed > 0) parts.push(`${summary.disputed} disputed`);
  if (summary.unchecked > 0) parts.push(`${summary.unchecked} unchecked`);
  if (summary.stale > 0) parts.push(`${summary.stale} needing re-review`);
  return `${parts.join(", ")} of ${summary.total} claims. A supported claim means someone attached a source, not that this app verified it.`;
}
