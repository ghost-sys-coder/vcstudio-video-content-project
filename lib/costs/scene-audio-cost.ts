/**
 * Text-to-speech cost estimation and reconciliation. OpenAI speech is billed by
 * input characters, so estimation is deterministic from the narration length.
 */

export interface SceneAudioCostRates {
  costPerMillionCharactersCents: number;
  minimumEstimateCents: number;
}

function assertNonnegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${label} must be a nonnegative integer.`);
}

export function estimateSceneAudioCostCents(input: {
  characterCount: number;
  rates: SceneAudioCostRates;
}): number {
  assertNonnegativeInteger(input.characterCount, "Character count");
  assertNonnegativeInteger(
    input.rates.costPerMillionCharactersCents,
    "Cost per million characters",
  );
  assertNonnegativeInteger(
    input.rates.minimumEstimateCents,
    "Minimum estimate",
  );
  const rawCents = Math.ceil(
    (input.characterCount * input.rates.costPerMillionCharactersCents) /
      1_000_000,
  );
  return Math.max(input.rates.minimumEstimateCents, rawCents);
}

export function calculateActualSceneAudioCostCents(input: {
  characterCount: number;
  rates: SceneAudioCostRates;
}): number {
  return estimateSceneAudioCostCents(input);
}

/** Each spoken segment is a separate provider request; silence is free. */
export function estimateSegmentedAudioCostCents(input: {
  parts: ReadonlyArray<{ kind: "speech"; text: string } | { kind: "pause" }>;
  rates: SceneAudioCostRates;
}): number {
  return input.parts.reduce(
    (sum, part) =>
      sum +
      (part.kind === "speech"
        ? estimateSceneAudioCostCents({
            characterCount: part.text.length,
            rates: input.rates,
          })
        : 0),
    0,
  );
}
