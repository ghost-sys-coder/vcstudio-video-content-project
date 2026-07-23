/**
 * Deliberately broad: any text containing the "histor" stem (history,
 * historical, historic, prehistoric, ...) is treated as historical content.
 * False positives just mean a factual-accuracy directive gets applied where
 * it isn't strictly needed — a safe direction to err in. False negatives
 * (a historical topic the model isn't told to fact-check) are the failure
 * mode this exists to avoid.
 */
const HISTORY_PATTERN = /histor/i;

/**
 * Whether a niche/topic/hook signals historical content, and therefore must
 * be held to a stricter factual-accuracy standard in AI generation: real,
 * verifiable events and figures only, no invented quotes or statistics, and
 * disputed details flagged as disputed rather than stated as settled fact.
 */
export function isHistoricalContent(input: {
  niche?: string;
  topic?: string;
  hookAngle?: string;
}): boolean {
  return [input.niche, input.topic, input.hookAngle].some(
    (text) => text !== undefined && HISTORY_PATTERN.test(text),
  );
}
