import {
  calculateTextCostCents,
  estimateTokens,
} from "@/lib/costs/scene-analysis-cost";

/**
 * Output is a short list: a scene number and a few-word title per chapter,
 * with JSON overhead. Sized for the largest list the prompt may ask for, so
 * the reservation is not routinely under-sized.
 */
const TOKENS_PER_CHAPTER = 30;
const OUTPUT_TOKEN_OVERHEAD = 150;

export function estimateChapterGenerationCost(input: {
  prompt: string;
  maximumChapters: number;
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
}) {
  const inputTokens = estimateTokens(input.prompt);
  const outputTokens =
    OUTPUT_TOKEN_OVERHEAD +
    Math.max(1, input.maximumChapters) * TOKENS_PER_CHAPTER;
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
