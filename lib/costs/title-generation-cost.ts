import {
  calculateTextCostCents,
  estimateTokens,
} from "@/lib/costs/scene-analysis-cost";

/**
 * Approximate tokens produced per requested title option: a short title plus a
 * one-sentence rationale and a hook-type label, with JSON overhead. Titles are
 * tiny, so — unlike scene analysis — there is no large output-token floor.
 */
const TOKENS_PER_OPTION = 60;
// Covers the platform description/caption and tag array in addition to titles.
// Deliberately conservative so the reservation is not routinely under-sized.
const OUTPUT_TOKEN_OVERHEAD = 500;

/**
 * Estimate platform-title-generation cost. Output size tracks the number of
 * requested options (each option is a short structured record), so the
 * output-token estimate is derived from `optionCount` rather than a fixed floor.
 */
export function estimateTitleGenerationCost(input: {
  prompt: string;
  optionCount: number;
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
}) {
  const inputTokens = estimateTokens(input.prompt);
  const outputTokens =
    OUTPUT_TOKEN_OVERHEAD + Math.max(1, input.optionCount) * TOKENS_PER_OPTION;
  return {
    inputTokens,
    outputTokens,
    estimatedCostCents: calculateTextCostCents({
      inputTokens,
      outputTokens,
      inputCostPerMillionCents: input.inputCostPerMillionCents,
      outputCostPerMillionCents: input.outputCostPerMillionCents,
    }),
  };
}
