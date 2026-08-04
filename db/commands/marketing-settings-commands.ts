import "server-only";

import { getDatabase } from "@/db/drizzle";
import { marketingSettings, type MarketingSettings } from "@/db/schema";
import type { MarketingSettingsInput } from "@/lib/schemas/marketing-settings";

/**
 * Writes a workspace's marketing settings, creating the row on first save.
 *
 * An upsert rather than a create-then-update pair: the row is optional until
 * somebody changes a default, so the first save and every later one are the
 * same operation. The unique index on `workspace_id` is what makes the conflict
 * target unambiguous, and what stops two concurrent first-saves creating two
 * rows.
 */
export async function upsertMarketingSettings(input: {
  workspaceId: string;
  updatedByUserId: string;
  settings: MarketingSettingsInput;
}): Promise<MarketingSettings> {
  const values = {
    workspaceId: input.workspaceId,
    updatedByUserId: input.updatedByUserId,
    autonomyLevel: input.settings.autonomyLevel,
    requireApprovalBeforePublish: input.settings.requireApprovalBeforePublish,
    defaultTimezone: input.settings.defaultTimezone,
    defaultLanguage: input.settings.defaultLanguage,
    brandedDefault: input.settings.brandedDefault,
    monthlyMarketingBudgetCents: input.settings.monthlyMarketingBudgetCents,
    dailyMaxGeneratedItems: input.settings.dailyMaxGeneratedItems,
    researchRefreshDays: input.settings.researchRefreshDays,
  };

  const [saved] = await getDatabase()
    .insert(marketingSettings)
    .values(values)
    .onConflictDoUpdate({
      target: marketingSettings.workspaceId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  if (!saved) throw new Error("MARKETING_SETTINGS_NOT_SAVED");
  return saved;
}
