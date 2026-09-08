/**
 * Narration normalization policy for script-to-scene fidelity checking.
 *
 * Fidelity validation compares the approved script against the concatenated
 * scene narration. Comparing raw strings would fail on differences no human
 * would call a change (a wrapped line, a stray non-breaking space), so a
 * normalization step is required. That step is also the dangerous part: every
 * transformation added here is a class of real corruption the check can no
 * longer see.
 *
 * The policy is therefore deliberately narrow. A transformation is allowed only
 * when the two strings are the *same text* by Unicode's own definition or by
 * the rules of plain-text layout. Anything that a narrator would read
 * differently, or that changes what a sentence asserts, is out of scope and
 * must surface as a discrepancy instead.
 *
 * Allowed, with the reason each is meaning-preserving:
 *
 * 1. Unicode NFC. Canonical composition only. "e" + U+0301 and "é" are defined
 *    by Unicode as the same character; a provider that re-emits one form is not
 *    changing the text. NFKC is deliberately NOT used: it is a *compatibility*
 *    mapping that rewrites "½" to "1/2", "ﬁ" to "fi" and superscripts to
 *    ordinary digits, all of which change what is written.
 * 2. CR and CRLF to LF. Line-ending form is a file-format artifact.
 * 3. Removal of zero-width characters. They have no rendering and no phonetic
 *    value in narration text; models and editors insert them incidentally.
 * 4. Whitespace runs collapsed to one space, and boundary whitespace trimmed.
 *    Narration is read aloud, so paragraph and line breaks are layout, not
 *    content. This also covers the non-breaking and typographic spaces.
 *
 * Explicitly NOT normalized, because each can change meaning or delivery:
 * letter case, punctuation of any kind, straight versus curly quotes, hyphen
 * versus en/em dash, ellipsis versus three periods, digits versus spelled
 * numbers, and every difference in wording. A punctuation-only mismatch is
 * reported as such by the coverage checker so a creator can judge it, rather
 * than being silently folded away here.
 */

export const NARRATION_NORMALIZATION_POLICY_VERSION =
  "narration-normalization-v1";

/** Zero-width space, ZWNJ, ZWJ, word joiner and BOM. */
const ZERO_WIDTH_PATTERN = /[\u200B\u200C\u200D\u2060\uFEFF]/gu;

/**
 * `\s` already covers CR, LF, tab, non-breaking space (U+00A0), the U+2000
 * range, line/paragraph separators and the ideographic space (U+3000), so the
 * line-ending and exotic-space rules collapse into this one pass.
 */
const WHITESPACE_RUN_PATTERN = /\s+/gu;

/** Applies the documented policy. Pure, and safe on already-normalized text. */
export function normalizeNarrationText(value: string): string {
  return value
    .normalize("NFC")
    .replace(ZERO_WIDTH_PATTERN, "")
    .replace(WHITESPACE_RUN_PATTERN, " ")
    .trim();
}

/**
 * Strips punctuation and symbols for *classification only*. Never used to
 * decide that two passages match — only to tell a creator that the sole
 * difference between what they approved and what came back is punctuation.
 */
export function stripPunctuationForComparison(value: string): string {
  return normalizeNarrationText(value.replace(/[\p{P}\p{S}]/gu, " "));
}

/** True when two passages differ only in punctuation or symbols. */
export function differsOnlyByPunctuation(
  expected: string,
  received: string,
): boolean {
  if (expected === received) return false;
  const strippedExpected = stripPunctuationForComparison(expected);
  return (
    strippedExpected.length > 0 &&
    strippedExpected === stripPunctuationForComparison(received)
  );
}
