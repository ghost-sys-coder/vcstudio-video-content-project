export interface RenderCostRates {
  costPerMinuteCents: number;
  minimumEstimateCents: number;
}

/**
 * Estimates the compute cost of a render from its output duration. There is no
 * per-render provider invoice, so cost is billed at a configured per-minute
 * rate. The duration is rounded up to the minute so a render never bills less
 * compute than it consumes, and a minimum floor covers fixed per-render
 * overhead (bundling, browser launch, upload).
 */
export function estimateRenderCostCents(input: {
  durationMilliseconds: number;
  rates: RenderCostRates;
}): number {
  if (
    !Number.isInteger(input.durationMilliseconds) ||
    input.durationMilliseconds < 0
  )
    throw new RangeError(
      "Duration milliseconds must be a nonnegative integer.",
    );
  if (input.rates.costPerMinuteCents <= 0)
    throw new RangeError("Cost per minute must be positive.");
  if (input.rates.minimumEstimateCents < 0)
    throw new RangeError("Minimum estimate must be nonnegative.");

  const billedMinutes = Math.ceil(input.durationMilliseconds / 60_000);
  const proportional = billedMinutes * input.rates.costPerMinuteCents;
  return Math.max(proportional, input.rates.minimumEstimateCents);
}
