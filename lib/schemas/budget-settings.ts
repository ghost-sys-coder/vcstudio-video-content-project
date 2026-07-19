import { z } from "zod";

const dollarsToCents = z.coerce
  .number()
  .min(0)
  .max(1_000_000)
  .transform((dollars) => Math.round(dollars * 100));

const blankToNull = (value: unknown) =>
  value === "" || value === null || value === undefined ? null : value;

const optionalPositiveInteger = z.preprocess(
  blankToNull,
  z.coerce.number().int().positive().nullable(),
);

const optionalNonnegativeInteger = z.preprocess(
  blankToNull,
  z.coerce.number().int().nonnegative().nullable(),
);

/** Parses the budget form (dollar inputs) into integer minor-currency units. */
export const budgetFormSchema = z.object({
  workspaceId: z.uuid(),
  dailyBudgetDollars: dollarsToCents,
  monthlyBudgetDollars: dollarsToCents,
  manualConfirmationThresholdDollars: dollarsToCents,
});

/** Parses the operational-limits form; blank fields fall back to env defaults. */
export const operationalLimitsFormSchema = z.object({
  workspaceId: z.uuid(),
  maxImagesPerBatch: optionalPositiveInteger,
  maxScenesPerAudioBatch: optionalPositiveInteger,
  maxRenderDurationSeconds: optionalPositiveInteger,
  maxRetryAttempts: optionalNonnegativeInteger,
});

export type BudgetFormInput = z.infer<typeof budgetFormSchema>;
export type OperationalLimitsFormInput = z.infer<
  typeof operationalLimitsFormSchema
>;
