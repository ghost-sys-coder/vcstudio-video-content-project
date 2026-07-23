import {
  calculateTextCostCents,
  estimateTokens,
} from "@/lib/costs/scene-analysis-cost";

/**
 * Approximate tokens produced per idea card: eight short structured fields
 * (topic, audience, tone, duration, platform, hook angle, rationale, hook type)
 * plus JSON overhead. Richer than a title option but still small — no large
 * output-token floor.
 */
const TOKENS_PER_IDEA = 130;
const OUTPUT_TOKEN_OVERHEAD = 60;

/**
 * Estimate idea-generation cost for the pre-generation UI preview. Output size
 * tracks the requested card count. Actual spend is recomputed from real token
 * usage when the run is recorded.
 */
export function estimateIdeaGenerationCost(input: {
  prompt: string;
  count: number;
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
}) {
  const inputTokens = estimateTokens(input.prompt);
  const outputTokens =
    OUTPUT_TOKEN_OVERHEAD + Math.max(1, input.count) * TOKENS_PER_IDEA;
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
