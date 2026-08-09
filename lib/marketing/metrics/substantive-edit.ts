const MAX_COMPARISON_CHARACTERS = 10_000;
export const SUBSTANTIVE_EDIT_DISTANCE_THRESHOLD = 0.2;

export function normalizeMarketingText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stableJson(value: Record<string, unknown> | null): string {
  if (!value) return "";
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, entry]),
    ),
  );
}

export function normalizedEditDistance(
  leftValue: string,
  rightValue: string,
): number {
  const left = normalizeMarketingText(leftValue).slice(
    0,
    MAX_COMPARISON_CHARACTERS,
  );
  const right = normalizeMarketingText(rightValue).slice(
    0,
    MAX_COMPARISON_CHARACTERS,
  );
  const denominator = Math.max(left.length, right.length);
  if (denominator === 0) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return (previous[right.length] ?? 0) / denominator;
}

export function isSubstantiveMarketingEdit(input: {
  originalText: string;
  revisedText: string;
  originalStructuredPayload: Record<string, unknown> | null;
  revisedStructuredPayload: Record<string, unknown> | null;
}): boolean {
  return (
    normalizedEditDistance(input.originalText, input.revisedText) >=
      SUBSTANTIVE_EDIT_DISTANCE_THRESHOLD ||
    stableJson(input.originalStructuredPayload) !==
      stableJson(input.revisedStructuredPayload)
  );
}
