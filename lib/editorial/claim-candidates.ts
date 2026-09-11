/**
 * Suggesting which sentences look like factual claims.
 *
 * **This is guidance and nothing else.** It reads the script's own characters
 * and flags sentences that carry the surface marks of a checkable assertion — a
 * figure, a date, a superlative, an appeal to authority. It does not know
 * whether any of them is true, and finding nothing here is not evidence that a
 * script contains no claims. Every consumer must let a reviewer mark any
 * sentence, including one this module said nothing about, and must never
 * present a clean result as a pass.
 *
 * **Why it is deterministic rather than generated.** Asking a model which
 * sentences are factual costs money on every keystroke burst and produces a
 * different answer each time, which is a poor basis for a review record that
 * has to be reproducible. It would also invite the exact confusion this slice
 * exists to remove: a model's opinion about a claim reading as a check of it.
 * Character rules are free, stable, and obviously not a verification.
 *
 * **Language coverage is uneven, deliberately stated rather than hidden.**
 * Digits, percent signs and currency symbols are matched by Unicode property,
 * so they work in any script. The superlative, quantifier and attribution cues
 * are English word lists and will not fire on a script written in another
 * language. That makes this a weaker hint outside English, never a stronger
 * assurance, and the interface says so.
 */

/** Shown wherever candidates appear. Never soften this into a verdict. */
export const CLAIM_CANDIDATE_GUIDANCE =
  "These sentences look like they contain checkable facts. This is a text hint, not a check — nothing here has been verified, and a claim it missed still needs review.";

export type ClaimSignal =
  "figure" | "percentage" | "money" | "date" | "superlative" | "attribution";

export interface ClaimCandidate {
  /** The sentence exactly as it appears, ready to be quoted into a claim. */
  text: string;
  /** Offset of the sentence in the original script content. */
  offset: number;
  /** Why it was flagged. Never empty for a returned candidate. */
  signals: ClaimSignal[];
}

const SENTENCE_BOUNDARY = /(?<=[.!?。！？])\s+|\n+/u;

const DIGIT = /\p{Nd}/u;
const PERCENTAGE = /%|\bper ?cent\b|\bpercent(age)?\b/iu;
const MONEY = /\p{Sc}|\b(dollars?|euros?|pounds?|usd|eur|gbp)\b/iu;
const YEAR = /\b[12]\p{Nd}{3}\b/u;
const MONTH =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/iu;
const SUPERLATIVE =
  /\b(most|least|best|worst|first|last|only|largest|smallest|highest|lowest|fastest|biggest|never|always|every|no one|nobody|everyone)\b/iu;
const ATTRIBUTION =
  /\b(according to|studies show|research shows|researchers found|experts say|data shows|reportedly|surveys? (show|found)|a study (found|showed))\b/iu;

function signalsIn(sentence: string): ClaimSignal[] {
  const signals: ClaimSignal[] = [];
  if (PERCENTAGE.test(sentence)) signals.push("percentage");
  if (MONEY.test(sentence)) signals.push("money");
  if (YEAR.test(sentence) || MONTH.test(sentence)) signals.push("date");
  if (ATTRIBUTION.test(sentence)) signals.push("attribution");
  if (SUPERLATIVE.test(sentence)) signals.push("superlative");
  // A bare figure is the weakest cue, so it only stands on its own when
  // nothing more specific explains the sentence.
  if (signals.length === 0 && DIGIT.test(sentence)) signals.push("figure");
  return signals;
}

/**
 * Splits a script into sentences with their offsets, then keeps the ones
 * carrying at least one signal.
 *
 * Offsets are into the original content, not a normalized copy, so a caller can
 * highlight the sentence where the writer actually sees it.
 */
export function findClaimCandidates(content: string): ClaimCandidate[] {
  const candidates: ClaimCandidate[] = [];
  let cursor = 0;
  for (const piece of content.split(SENTENCE_BOUNDARY)) {
    const offset = content.indexOf(piece, cursor);
    if (offset === -1) continue;
    cursor = offset + piece.length;
    const text = piece.trim();
    if (text.length === 0) continue;
    const signals = signalsIn(text);
    if (signals.length === 0) continue;
    candidates.push({
      text,
      offset: offset + piece.indexOf(text),
      signals,
    });
  }
  return candidates;
}

const SIGNAL_LABELS: Record<ClaimSignal, string> = {
  figure: "a figure",
  percentage: "a percentage",
  money: "an amount of money",
  date: "a date",
  superlative: "a superlative",
  attribution: "an appeal to a source",
};

/** Plain-language reason a sentence was suggested. */
export function describeClaimSignals(signals: readonly ClaimSignal[]): string {
  const parts = signals.map((signal) => SIGNAL_LABELS[signal]);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `Contains ${parts[0]}.`;
  return `Contains ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.`;
}
