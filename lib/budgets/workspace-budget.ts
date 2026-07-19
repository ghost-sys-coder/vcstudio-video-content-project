import "server-only";

import { getWorkspaceBudgetSettings } from "@/db/repositories/budget-settings.repository";
import {
  resolveEffectiveBudget,
  type EffectiveBudget,
} from "@/lib/budgets/budget-settings";
import { getUsageEnvironment } from "@/lib/env/server";

/**
 * Resolves a workspace's effective daily/monthly budgets and manual-confirmation
 * threshold: the editable `workspace_budget_settings` row when present, otherwise
 * the environment defaults. This is the single source the reservation preflight
 * and the money-safe reservation command both read, so the UI disable and the
 * server-side budget guard always agree.
 */
export async function loadEffectiveWorkspaceBudget(input: {
  workspaceId: string;
}): Promise<EffectiveBudget> {
  const environment = getUsageEnvironment();
  const row = await getWorkspaceBudgetSettings({
    workspaceId: input.workspaceId,
  });
  return resolveEffectiveBudget(row, {
    dailyBudgetCents: environment.DEFAULT_DAILY_BUDGET_CENTS,
    monthlyBudgetCents: environment.DEFAULT_MONTHLY_BUDGET_CENTS,
    manualConfirmationThresholdCents:
      environment.MANUAL_CONFIRMATION_THRESHOLD_CENTS,
  });
}
