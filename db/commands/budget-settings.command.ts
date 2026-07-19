import "server-only";

import { getDatabase } from "@/db/drizzle";
import {
  workspaceBudgetSettings,
  type WorkspaceBudgetSettings,
} from "@/db/schema";
import { getWorkspaceBudgetSettings } from "@/db/repositories/budget-settings.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import type { BudgetSettingsInput } from "@/lib/budgets/budget-settings";

function budgetChanged(
  existing: WorkspaceBudgetSettings | null,
  next: BudgetSettingsInput,
): boolean {
  return (
    !existing ||
    existing.dailyBudgetCents !== next.dailyBudgetCents ||
    existing.monthlyBudgetCents !== next.monthlyBudgetCents ||
    existing.manualConfirmationThresholdCents !==
      next.manualConfirmationThresholdCents
  );
}

function limitsChanged(
  existing: WorkspaceBudgetSettings | null,
  next: BudgetSettingsInput,
): boolean {
  return (
    !existing ||
    existing.maxImagesPerBatch !== next.maxImagesPerBatch ||
    existing.maxScenesPerAudioBatch !== next.maxScenesPerAudioBatch ||
    existing.maxRenderDurationSeconds !== next.maxRenderDurationSeconds ||
    existing.maxRetryAttempts !== next.maxRetryAttempts
  );
}

/**
 * Creates or updates a workspace's editable budgets and operational-limit
 * overrides, then records the corresponding audit event(s). The row is keyed by
 * the unique `workspace_id`, so a repeat save updates in place. The reservation
 * money-safe write path is untouched — these values are only read at
 * reservation time by the `*-workspace-details` helpers.
 */
export async function upsertWorkspaceBudgetSettings(input: {
  workspaceId: string;
  actorUserId: string;
  settings: BudgetSettingsInput;
}): Promise<WorkspaceBudgetSettings> {
  const existing = await getWorkspaceBudgetSettings({
    workspaceId: input.workspaceId,
  });
  const now = new Date();
  const values = {
    dailyBudgetCents: input.settings.dailyBudgetCents,
    monthlyBudgetCents: input.settings.monthlyBudgetCents,
    manualConfirmationThresholdCents:
      input.settings.manualConfirmationThresholdCents,
    maxImagesPerBatch: input.settings.maxImagesPerBatch,
    maxScenesPerAudioBatch: input.settings.maxScenesPerAudioBatch,
    maxRenderDurationSeconds: input.settings.maxRenderDurationSeconds,
    maxRetryAttempts: input.settings.maxRetryAttempts,
    updatedByUserId: input.actorUserId,
  };

  const [row] = await getDatabase()
    .insert(workspaceBudgetSettings)
    .values({ workspaceId: input.workspaceId, ...values })
    .onConflictDoUpdate({
      target: workspaceBudgetSettings.workspaceId,
      set: { ...values, updatedAt: now },
    })
    .returning();
  if (!row) throw new Error("BUDGET_SETTINGS_UPSERT_FAILED");

  if (budgetChanged(existing, input.settings)) {
    await recordAuditEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "budget_changed",
      targetType: "workspace",
      targetId: input.workspaceId,
      metadata: {
        dailyBudgetCents: input.settings.dailyBudgetCents,
        monthlyBudgetCents: input.settings.monthlyBudgetCents,
        manualConfirmationThresholdCents:
          input.settings.manualConfirmationThresholdCents,
      },
    });
  }
  if (limitsChanged(existing, input.settings)) {
    await recordAuditEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "limits_changed",
      targetType: "workspace",
      targetId: input.workspaceId,
      metadata: {
        maxImagesPerBatch: input.settings.maxImagesPerBatch,
        maxScenesPerAudioBatch: input.settings.maxScenesPerAudioBatch,
        maxRenderDurationSeconds: input.settings.maxRenderDurationSeconds,
        maxRetryAttempts: input.settings.maxRetryAttempts,
      },
    });
  }

  return row;
}
