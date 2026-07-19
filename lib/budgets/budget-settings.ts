import { z } from "zod";

/**
 * Pure resolution of a workspace's effective budgets and operational limits.
 *
 * Budgets are editable per workspace (a `workspace_budget_settings` row); when
 * no row exists the environment defaults apply. Operational limits are stored as
 * nullable per-workspace overrides that fall back to the environment default.
 * Everything here is integer minor-currency units — never floats.
 */

export type BudgetDefaults = {
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  manualConfirmationThresholdCents: number;
};

export type OperationalLimitDefaults = {
  maxImagesPerBatch: number;
  maxScenesPerAudioBatch: number;
  maxRenderDurationSeconds: number;
  maxRetryAttempts: number;
};

/** The editable subset of a persisted `workspace_budget_settings` row. */
export type BudgetSettingsRow = {
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  manualConfirmationThresholdCents: number;
  maxImagesPerBatch: number | null;
  maxScenesPerAudioBatch: number | null;
  maxRenderDurationSeconds: number | null;
  maxRetryAttempts: number | null;
};

export type EffectiveBudget = BudgetDefaults;
export type EffectiveLimits = OperationalLimitDefaults;

function assertNonnegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${label} must be a nonnegative integer.`);
}

export function resolveEffectiveBudget(
  row: BudgetSettingsRow | null,
  defaults: BudgetDefaults,
): EffectiveBudget {
  if (!row) return { ...defaults };
  return {
    dailyBudgetCents: row.dailyBudgetCents,
    monthlyBudgetCents: row.monthlyBudgetCents,
    manualConfirmationThresholdCents: row.manualConfirmationThresholdCents,
  };
}

export function resolveEffectiveLimits(
  row: BudgetSettingsRow | null,
  defaults: OperationalLimitDefaults,
): EffectiveLimits {
  return {
    maxImagesPerBatch: row?.maxImagesPerBatch ?? defaults.maxImagesPerBatch,
    maxScenesPerAudioBatch:
      row?.maxScenesPerAudioBatch ?? defaults.maxScenesPerAudioBatch,
    maxRenderDurationSeconds:
      row?.maxRenderDurationSeconds ?? defaults.maxRenderDurationSeconds,
    maxRetryAttempts: row?.maxRetryAttempts ?? defaults.maxRetryAttempts,
  };
}

/**
 * True when an estimate is large enough to require a heightened, explicit
 * confirmation before spending. A threshold of `0` means every estimate needs
 * confirmation ("always confirm"); a very large threshold effectively disables
 * the extra gate.
 */
export function requiresManualConfirmation(
  estimatedCostCents: number,
  thresholdCents: number,
): boolean {
  assertNonnegativeInteger(estimatedCostCents, "Estimated cost");
  assertNonnegativeInteger(thresholdCents, "Manual confirmation threshold");
  return estimatedCostCents >= thresholdCents;
}

/** Validation for the budget/limits settings form. */
export const budgetSettingsSchema = z
  .object({
    dailyBudgetCents: z.number().int().nonnegative().max(10_000_000),
    monthlyBudgetCents: z.number().int().nonnegative().max(100_000_000),
    manualConfirmationThresholdCents: z
      .number()
      .int()
      .nonnegative()
      .max(10_000_000),
    maxImagesPerBatch: z.number().int().positive().max(100).nullable(),
    maxScenesPerAudioBatch: z.number().int().positive().max(100).nullable(),
    maxRenderDurationSeconds: z.number().int().positive().max(7200).nullable(),
    maxRetryAttempts: z.number().int().nonnegative().max(3).nullable(),
  })
  .refine((value) => value.dailyBudgetCents <= value.monthlyBudgetCents, {
    message: "Daily budget cannot exceed the monthly budget.",
    path: ["dailyBudgetCents"],
  });

export type BudgetSettingsInput = z.infer<typeof budgetSettingsSchema>;
