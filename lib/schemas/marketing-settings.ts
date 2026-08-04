import { z } from "zod";

export const MARKETING_AUTONOMY_LEVELS = [
  "manual",
  "assisted",
  "autonomous",
] as const;

/**
 * Autonomy levels that may currently be selected.
 *
 * `autonomous` is deliberately absent: the column and the control exist from
 * Slice 0 so the shape of the ladder is visible, but capped auto-approval and
 * its brand-safety checks land in Slice 14. Offering the value before the
 * enforcement exists would mean a setting that claims more than it does.
 */
export const SELECTABLE_AUTONOMY_LEVELS = ["manual", "assisted"] as const;

export const MAX_DAILY_GENERATED_ITEMS = 100;
export const MAX_RESEARCH_REFRESH_DAYS = 90;

export const marketingSettingsSchema = z.object({
  autonomyLevel: z.enum(SELECTABLE_AUTONOMY_LEVELS),
  requireApprovalBeforePublish: z.boolean(),
  defaultTimezone: z.string().trim().min(1).max(64),
  defaultLanguage: z.string().trim().min(1).max(64),
  brandedDefault: z.boolean(),
  monthlyMarketingBudgetCents: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .nullable(),
  dailyMaxGeneratedItems: z
    .number()
    .int()
    .min(1)
    .max(MAX_DAILY_GENERATED_ITEMS),
  researchRefreshDays: z.number().int().min(1).max(MAX_RESEARCH_REFRESH_DAYS),
});

export type MarketingSettingsInput = z.infer<typeof marketingSettingsSchema>;

/**
 * Parses the settings form.
 *
 * Checkboxes are absent from `FormData` when unticked rather than sent as
 * `false`, and an empty budget field means "no sub-cap" rather than zero — both
 * are normalised here so the schema above can stay a plain description of the
 * stored shape.
 */
export const marketingSettingsFormSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null) return value;
  const raw = value as Record<string, unknown>;
  const budget = String(raw.monthlyMarketingBudgetCents ?? "").trim();
  return {
    autonomyLevel: raw.autonomyLevel,
    requireApprovalBeforePublish: raw.requireApprovalBeforePublish === "on",
    defaultTimezone: raw.defaultTimezone,
    defaultLanguage: raw.defaultLanguage,
    brandedDefault: raw.brandedDefault === "on",
    monthlyMarketingBudgetCents: budget === "" ? null : Number(budget),
    dailyMaxGeneratedItems: Number(raw.dailyMaxGeneratedItems),
    researchRefreshDays: Number(raw.researchRefreshDays),
  };
}, marketingSettingsSchema);
