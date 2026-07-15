export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function calculateTextCostCents(input: {
  inputTokens: number;
  outputTokens: number;
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
}): number {
  return Math.max(
    1,
    Math.ceil(
      (input.inputTokens * input.inputCostPerMillionCents +
        input.outputTokens * input.outputCostPerMillionCents) /
        1_000_000,
    ),
  );
}

export function estimateSceneAnalysisCost(input: {
  prompt: string;
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
}) {
  const inputTokens = estimateTokens(input.prompt);
  const outputTokens = Math.max(2000, Math.ceil(inputTokens * 1.5));
  return {
    inputTokens,
    outputTokens,
    estimatedCostCents: calculateTextCostCents({
      ...input,
      inputTokens,
      outputTokens,
    }),
  };
}
