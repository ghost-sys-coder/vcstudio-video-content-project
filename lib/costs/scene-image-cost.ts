import { estimateTokens } from "@/lib/costs/scene-analysis-cost";
import type {
  SceneImageApiSize,
  SceneImageQuality,
} from "@/lib/schemas/scene-image";

export type ImageGenerationUsage = {
  inputTextTokens: number;
  inputImageTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ImageGenerationTokenRates = {
  textInputCostPerMillionCents: number;
  imageInputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
};

export type SceneImageOutputCostMatrix = Record<
  SceneImageQuality,
  Record<SceneImageApiSize, number>
>;

function assertNonnegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${label} must be a nonnegative finite number.`);
}

function costFromTokens(tokens: number, costPerMillionCents: number): number {
  return (tokens * costPerMillionCents) / 1_000_000;
}

export function estimateSceneImageCost(input: {
  prompt: string;
  quality: SceneImageQuality;
  size: SceneImageApiSize;
  referenceAssetCount: number;
  outputCostMatrix: SceneImageOutputCostMatrix;
  textInputCostPerMillionCents: number;
  referenceInputReserveCents: number;
  safetyMarginBasisPoints: number;
}) {
  assertNonnegativeFinite(
    input.textInputCostPerMillionCents,
    "Text input rate",
  );
  assertNonnegativeFinite(
    input.referenceInputReserveCents,
    "Reference reserve",
  );
  assertNonnegativeFinite(input.safetyMarginBasisPoints, "Safety margin");
  if (
    !Number.isInteger(input.referenceAssetCount) ||
    input.referenceAssetCount < 0
  )
    throw new RangeError(
      "Reference asset count must be a nonnegative integer.",
    );

  const textInputTokens = estimateTokens(input.prompt);
  const textInputCostCents = Math.ceil(
    costFromTokens(textInputTokens, input.textInputCostPerMillionCents),
  );
  const referenceInputCostCents = Math.ceil(
    input.referenceAssetCount * input.referenceInputReserveCents,
  );
  const outputCostCents = input.outputCostMatrix[input.quality][input.size];
  assertNonnegativeFinite(outputCostCents, "Output cost");

  const subtotalCostCents = Math.ceil(
    textInputCostCents + referenceInputCostCents + outputCostCents,
  );
  const estimatedCostCents = Math.max(
    1,
    Math.ceil(
      (subtotalCostCents * (10_000 + input.safetyMarginBasisPoints)) / 10_000,
    ),
  );

  return {
    textInputTokens,
    textInputCostCents,
    referenceInputCostCents,
    outputCostCents,
    safetyMarginCostCents: estimatedCostCents - subtotalCostCents,
    estimatedCostCents,
  };
}

export function calculateActualSceneImageCostCents(input: {
  usage: ImageGenerationUsage;
  rates: ImageGenerationTokenRates;
}): number {
  const values = [
    input.usage.inputTextTokens,
    input.usage.inputImageTokens,
    input.usage.outputTokens,
    input.usage.totalTokens,
    input.rates.textInputCostPerMillionCents,
    input.rates.imageInputCostPerMillionCents,
    input.rates.outputCostPerMillionCents,
  ];
  values.forEach((value) => assertNonnegativeFinite(value, "Usage or rate"));

  const rawCostCents =
    costFromTokens(
      input.usage.inputTextTokens,
      input.rates.textInputCostPerMillionCents,
    ) +
    costFromTokens(
      input.usage.inputImageTokens,
      input.rates.imageInputCostPerMillionCents,
    ) +
    costFromTokens(
      input.usage.outputTokens,
      input.rates.outputCostPerMillionCents,
    );

  if (rawCostCents === 0) return 0;
  return Math.max(1, Math.ceil(rawCostCents));
}

export type SceneImageCostReconciliation = {
  costBasis: "provider_usage" | "estimate_fallback";
  chargedCostCents: number;
  releasedCostCents: number;
  overageCostCents: number;
};

export function reconcileSceneImageCost(input: {
  reservedCostCents: number;
  actualCostCents: number | null;
}): SceneImageCostReconciliation {
  assertNonnegativeFinite(input.reservedCostCents, "Reserved cost");
  if (input.actualCostCents !== null)
    assertNonnegativeFinite(input.actualCostCents, "Actual cost");

  const chargedCostCents = input.actualCostCents ?? input.reservedCostCents;
  return {
    costBasis:
      input.actualCostCents === null ? "estimate_fallback" : "provider_usage",
    chargedCostCents,
    releasedCostCents: Math.max(0, input.reservedCostCents - chargedCostCents),
    overageCostCents: Math.max(0, chargedCostCents - input.reservedCostCents),
  };
}
