import {
  calculateTextCostCents,
  estimateTokens,
} from "@/lib/costs/scene-analysis-cost";

const WORDS_PER_SECOND = 2.5;
const TOKENS_PER_WORD = 1.35;
const DEFAULT_DURATION_SECONDS = 90;
const MINIMUM_OUTPUT_TOKENS = 400;

/**
 * Estimate script-generation cost. Unlike scene analysis (which floors output at
 * 2000 tokens for a large structured plan), a script's output size tracks the
 * requested narration duration (~2.5 words/sec), so the output-token estimate is
 * derived from `targetDurationSeconds`.
 */
export function estimateScriptGenerationCost(input: {
  prompt: string;
  targetDurationSeconds: number | null;
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
}) {
  const inputTokens = estimateTokens(input.prompt);
  const durationSeconds =
    input.targetDurationSeconds && input.targetDurationSeconds > 0
      ? input.targetDurationSeconds
      : DEFAULT_DURATION_SECONDS;
  const targetWords = durationSeconds * WORDS_PER_SECOND;
  const outputTokens = Math.max(
    MINIMUM_OUTPUT_TOKENS,
    Math.ceil(targetWords * TOKENS_PER_WORD) + 120,
  );
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
