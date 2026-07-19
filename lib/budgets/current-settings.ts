import "server-only";

import { getWorkspaceBudgetSettings } from "@/db/repositories/budget-settings.repository";
import type { BudgetSettingsInput } from "@/lib/budgets/budget-settings";
import {
  getSceneAudioEnvironment,
  getSceneImageEnvironment,
  getRenderEnvironment,
  getUsageEnvironment,
} from "@/lib/env/server";
import type { EffectiveLimits } from "@/lib/budgets/budget-settings";
import { resolveEffectiveLimits } from "@/lib/budgets/budget-settings";

function limitEnvDefaults() {
  return {
    maxImagesPerBatch: getSceneImageEnvironment().MAX_IMAGES_PER_BATCH,
    maxScenesPerAudioBatch:
      getSceneAudioEnvironment().MAX_SCENES_PER_AUDIO_BATCH,
    maxRenderDurationSeconds:
      getRenderEnvironment().MAX_RENDER_DURATION_SECONDS,
    maxRetryAttempts: getRenderEnvironment().MAX_RENDER_ATTEMPTS,
  };
}

/**
 * The full, current editable settings for a workspace as a `BudgetSettingsInput`
 * — the persisted row when present, otherwise the environment budget defaults
 * with null (env-fallback) operational-limit overrides. Reused by the dashboard
 * (to prefill the forms) and by both save actions (so each form only submits its
 * own half without clobbering the other).
 */
export async function loadCurrentBudgetSettingsInput(input: {
  workspaceId: string;
}): Promise<BudgetSettingsInput> {
  const row = await getWorkspaceBudgetSettings(input);
  if (row)
    return {
      dailyBudgetCents: row.dailyBudgetCents,
      monthlyBudgetCents: row.monthlyBudgetCents,
      manualConfirmationThresholdCents: row.manualConfirmationThresholdCents,
      maxImagesPerBatch: row.maxImagesPerBatch,
      maxScenesPerAudioBatch: row.maxScenesPerAudioBatch,
      maxRenderDurationSeconds: row.maxRenderDurationSeconds,
      maxRetryAttempts: row.maxRetryAttempts,
    };
  const usage = getUsageEnvironment();
  return {
    dailyBudgetCents: usage.DEFAULT_DAILY_BUDGET_CENTS,
    monthlyBudgetCents: usage.DEFAULT_MONTHLY_BUDGET_CENTS,
    manualConfirmationThresholdCents: usage.MANUAL_CONFIRMATION_THRESHOLD_CENTS,
    maxImagesPerBatch: null,
    maxScenesPerAudioBatch: null,
    maxRenderDurationSeconds: null,
    maxRetryAttempts: null,
  };
}

/**
 * Resolves the effective operational limits for a workspace: each per-workspace
 * override when set, otherwise the environment default. This is the single
 * source the batch/duration enforcement and display sites read, mirroring
 * {@link loadEffectiveWorkspaceBudget}.
 */
export async function loadEffectiveWorkspaceLimits(input: {
  workspaceId: string;
}): Promise<EffectiveLimits> {
  const row = await getWorkspaceBudgetSettings(input);
  return resolveEffectiveLimits(row, limitEnvDefaults());
}

export function getOperationalLimitEnvDefaults() {
  return limitEnvDefaults();
}
