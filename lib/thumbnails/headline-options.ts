import { MAX_THUMBNAIL_HEADLINE_LENGTH } from "@/lib/schemas/thumbnail";

export const MAX_HEADLINE_OPTIONS = 6;

/** Minimum useful headline; shorter fragments read as noise on a thumbnail. */
const MIN_HEADLINE_LENGTH = 3;

const SEGMENT_SEPARATORS = /[:|•·]|\s[–—-]\s/;

/**
 * A thumbnail headline is not a title: it has to land in 2–5 words at a glance,
 * so a title's scaffolding (bracketed asides, subtitle clauses, trailing
 * punctuation) is stripped and the punchiest surviving segment is kept.
 *
 * Pure and deterministic — the same title always condenses the same way.
 */
export function condenseToHeadline(value: string): string {
  const withoutAsides = value
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/["“”'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutAsides === "") return "";

  // Prefer the segment after a colon or dash — in a title that is usually the
  // hook, while the part before it is context the image already conveys.
  const segments = withoutAsides
    .split(SEGMENT_SEPARATORS)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= MIN_HEADLINE_LENGTH);
  const candidates = segments.length > 1 ? [...segments].reverse() : segments;
  const chosen =
    candidates.find(
      (segment) => segment.length <= MAX_THUMBNAIL_HEADLINE_LENGTH,
    ) ??
    candidates[0] ??
    withoutAsides;

  const trimmed = chosen.replace(/[.,;:]+$/g, "").trim();
  if (trimmed.length <= MAX_THUMBNAIL_HEADLINE_LENGTH) return trimmed;

  // Truncate on a word boundary rather than mid-word; no ellipsis, because the
  // text is baked into the image and a trailing "…" reads as a mistake.
  const words = trimmed.split(" ");
  const kept: string[] = [];
  for (const word of words) {
    const next = kept.length === 0 ? word : `${kept.join(" ")} ${word}`;
    if (next.length > MAX_THUMBNAIL_HEADLINE_LENGTH) break;
    kept.push(word);
  }
  return kept.join(" ").replace(/[.,;:]+$/g, "");
}

/**
 * Build suggested headlines for the baked-text thumbnail mode.
 *
 * These are derived from work the project already paid for — the platform's
 * generated titles, then the brief's hook angle and topic as fallbacks — so
 * offering them costs nothing and needs no extra provider call. They are
 * starting points the user is expected to edit, not finished copy.
 */
export function buildHeadlineOptions(input: {
  titles: string[];
  hookAngle: string;
  topic: string;
  limit?: number;
}): string[] {
  const limit = input.limit ?? MAX_HEADLINE_OPTIONS;
  const sources = [...input.titles, input.hookAngle, input.topic];
  const options: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (options.length >= limit) break;
    const headline = condenseToHeadline(source ?? "");
    if (headline.length < MIN_HEADLINE_LENGTH) continue;
    const key = headline.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(headline);
  }

  return options;
}
