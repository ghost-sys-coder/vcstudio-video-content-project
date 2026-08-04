import "server-only";

import { findMarketingSettings } from "@/db/repositories/marketing-settings.repository";
import type { MarketingSettingsInput } from "@/lib/schemas/marketing-settings";

/**
 * The defaults a workspace has before anyone saves settings.
 *
 * Deliberately the most conservative position on every axis: nothing generates
 * on a timer, nothing publishes without approval, and there is no marketing
 * sub-cap beyond the workspace budget. A workspace that has never visited the
 * settings page behaves as if a human is watching, because one is.
 */
export const DEFAULT_MARKETING_SETTINGS: MarketingSettingsInput = {
  autonomyLevel: "manual",
  requireApprovalBeforePublish: true,
  defaultTimezone: "UTC",
  defaultLanguage: "English",
  brandedDefault: true,
  monthlyMarketingBudgetCents: null,
  dailyMaxGeneratedItems: 10,
  researchRefreshDays: 7,
};

/**
 * Resolves a workspace's effective settings, falling back to the defaults when
 * no row exists. Callers never branch on the row's existence — the absence of a
 * row is a valid, meaningful state, not a missing one.
 */
export async function loadMarketingSettings(input: {
  workspaceId: string;
}): Promise<MarketingSettingsInput> {
  const stored = await findMarketingSettings({
    workspaceId: input.workspaceId,
  });
  if (!stored) return DEFAULT_MARKETING_SETTINGS;

  return {
    // A row written before `autonomous` was selectable can still hold it; the
    // form narrows what may be chosen, not what may be read.
    autonomyLevel:
      stored.autonomyLevel === "autonomous" ? "assisted" : stored.autonomyLevel,
    requireApprovalBeforePublish: stored.requireApprovalBeforePublish,
    defaultTimezone: stored.defaultTimezone,
    defaultLanguage: stored.defaultLanguage,
    brandedDefault: stored.brandedDefault,
    monthlyMarketingBudgetCents: stored.monthlyMarketingBudgetCents,
    dailyMaxGeneratedItems: stored.dailyMaxGeneratedItems,
    researchRefreshDays: stored.researchRefreshDays,
  };
}
