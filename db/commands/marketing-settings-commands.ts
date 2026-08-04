import "server-only";

import { getDatabase } from "@/db/drizzle";
import { marketingSettings, type MarketingSettings } from "@/db/schema";
import type { MarketingSettingsInput } from "@/lib/schemas/marketing-settings";

/**
 * Flips the workspace's own Marketing Studio switch.
 *
 * Deliberately its own command touching one column, rather than a field on
 * `upsertMarketingSettings`. The two are edited from different pages by
 * different people — the switch from workspace settings by an owner, the rest
 * from the studio's own settings page — and folding them together would mean
 * saving one form could silently revert the other. The upsert below omits
 * `studioEnabled` from its `set` for exactly the same reason.
 */
export async function setMarketingStudioEnabled(input: {
  workspaceId: string;
  updatedByUserId: string;
  enabled: boolean;
}): Promise<void> {
  const now = new Date();
  await getDatabase()
    .insert(marketingSettings)
    .values({
      workspaceId: input.workspaceId,
      updatedByUserId: input.updatedByUserId,
      studioEnabled: input.enabled,
    })
    .onConflictDoUpdate({
      target: marketingSettings.workspaceId,
      set: {
        studioEnabled: input.enabled,
        updatedByUserId: input.updatedByUserId,
        updatedAt: now,
      },
    });
}

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
