/**
 * Deciding whether an editorial review still describes the script in front of
 * you.
 *
 * A claim is reviewed against an exact excerpt a person quoted out of the
 * script. The script then keeps being edited. The question this module answers
 * is the one that makes a sign-off trustworthy: *is the sentence I checked
 * still there, word for word?*
 *
 * The rule is deliberately blunt. A claim anchors when its quoted excerpt still
 * occurs in the script; otherwise its review is stale and must be redone. There
 * is no similarity score and no fuzzy match, because a near-match is exactly
 * the dangerous case — "the fund returned 8%" and "the fund returned 18%" are
 * one character apart and are not the same claim. A checker that tolerated that
 * would launder an unreviewed number through an old approval.
 *
 * The one thing that is tolerated is layout. Comparison runs through the
 * narration normalization policy, so rewrapping a paragraph, pasting text that
 * arrives with CRLF line endings, or an editor inserting a zero-width character
 * does not invalidate a genuine review. Every other difference — case,
 * punctuation, a swapped word, a changed digit — breaks the anchor, which is
 * the intended behaviour. That policy is documented and justified rule by rule
 * in `lib/domain/narration-normalization.ts`; this module deliberately does not
 * invent a second, looser notion of "the same text".
 */

import { normalizeNarrationText } from "@/lib/domain/narration-normalization";

export interface AnchoredClaim<T> {
  claim: T;
  /**
   * Character offset of the excerpt within the normalized script, or `null`
   * when the excerpt is no longer present.
   */
  offset: number | null;
  anchored: boolean;
}

/** The smallest shape this module needs. Anything with a quote can anchor. */
export interface AnchorableClaim {
  quotedText: string;
}

/**
 * Where a quoted excerpt sits in a script, or `null` when it is gone.
 *
 * An empty or whitespace-only quote never anchors. It would otherwise match at
 * offset 0 in every script, which would make a meaningless claim permanently
 * "still present" and quietly hold a sign-off open.
 */
export function locateClaimQuote(input: {
  scriptContent: string;
  quotedText: string;
}): number | null {
  const quote = normalizeNarrationText(input.quotedText);
  if (quote.length === 0) return null;
  const offset = normalizeNarrationText(input.scriptContent).indexOf(quote);
  return offset === -1 ? null : offset;
}

/** True when the excerpt this claim was reviewed against is still in the script. */
export function isClaimAnchored(input: {
  scriptContent: string;
  quotedText: string;
}): boolean {
  return locateClaimQuote(input) !== null;
}

/**
 * Anchors every claim against one script, ordered as a reader meets them.
 *
 * Claims that no longer anchor sort last rather than being dropped: a stale
 * claim is the thing a reviewer most needs to see, and hiding it would turn an
 * invalidated review into a silently shorter list.
 */
export function anchorClaims<T extends AnchorableClaim>(input: {
  scriptContent: string;
  claims: readonly T[];
}): AnchoredClaim<T>[] {
  const script = normalizeNarrationText(input.scriptContent);
  return input.claims
    .map((claim) => {
      const offset = locateClaimQuote({
        scriptContent: script,
        quotedText: claim.quotedText,
      });
      return { claim, offset, anchored: offset !== null };
    })
    .sort((first, second) => {
      if (first.offset === null && second.offset === null) return 0;
      if (first.offset === null) return 1;
      if (second.offset === null) return -1;
      return first.offset - second.offset;
    });
}
