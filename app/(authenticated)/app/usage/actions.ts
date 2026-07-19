"use server";

import { revalidatePath } from "next/cache";
import { upsertWorkspaceBudgetSettings } from "@/db/commands/budget-settings.command";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { budgetSettingsSchema } from "@/lib/budgets/budget-settings";
import { loadCurrentBudgetSettingsInput } from "@/lib/budgets/current-settings";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";
import {
  budgetFormSchema,
  operationalLimitsFormSchema,
} from "@/lib/schemas/budget-settings";

export type BudgetSettingsActionState = {
  error: string | null;
  success: boolean;
};

// Each form edits only its half of the `workspace_budget_settings` row, so both
// actions load the current full settings, override just their fields, and
// re-validate the merged result before upserting.
export async function saveBudgetSettingsAction(
  formData: FormData,
): Promise<BudgetSettingsActionState> {
  const parsed = budgetFormSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    dailyBudgetDollars: formData.get("dailyBudgetDollars"),
    monthlyBudgetDollars: formData.get("monthlyBudgetDollars"),
    manualConfirmationThresholdDollars: formData.get(
      "manualConfirmationThresholdDollars",
    ),
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid budget settings.",
      success: false,
    };

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageUsage");

    const current = await loadCurrentBudgetSettingsInput({
      workspaceId: parsed.data.workspaceId,
    });
    // The form values were transformed to integer cents by the schema.
    const merged = budgetSettingsSchema.safeParse({
      ...current,
      dailyBudgetCents: parsed.data.dailyBudgetDollars,
      monthlyBudgetCents: parsed.data.monthlyBudgetDollars,
      manualConfirmationThresholdCents:
        parsed.data.manualConfirmationThresholdDollars,
    });
    if (!merged.success)
      return {
        error:
          merged.error.issues[0]?.message ??
          "The daily budget cannot exceed the monthly budget.",
        success: false,
      };

    await upsertWorkspaceBudgetSettings({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      settings: merged.data,
    });
    revalidatePath("/app/usage");
    return { error: null, success: true };
  } catch (error) {
    if (error instanceof WorkspacePermissionDeniedError)
      return {
        error: "You do not have permission to change budgets.",
        success: false,
      };
    return { error: "The budget settings could not be saved.", success: false };
  }
}

export async function saveOperationalLimitsAction(
  formData: FormData,
): Promise<BudgetSettingsActionState> {
  const parsed = operationalLimitsFormSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    maxImagesPerBatch: formData.get("maxImagesPerBatch"),
    maxScenesPerAudioBatch: formData.get("maxScenesPerAudioBatch"),
    maxRenderDurationSeconds: formData.get("maxRenderDurationSeconds"),
    maxRetryAttempts: formData.get("maxRetryAttempts"),
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid operational limits.",
      success: false,
    };

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageUsage");

    const current = await loadCurrentBudgetSettingsInput({
      workspaceId: parsed.data.workspaceId,
    });
    const merged = budgetSettingsSchema.safeParse({
      ...current,
      maxImagesPerBatch: parsed.data.maxImagesPerBatch,
      maxScenesPerAudioBatch: parsed.data.maxScenesPerAudioBatch,
      maxRenderDurationSeconds: parsed.data.maxRenderDurationSeconds,
      maxRetryAttempts: parsed.data.maxRetryAttempts,
    });
    if (!merged.success)
      return {
        error: merged.error.issues[0]?.message ?? "Invalid operational limits.",
        success: false,
      };

    await upsertWorkspaceBudgetSettings({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      settings: merged.data,
    });
    revalidatePath("/app/usage");
    return { error: null, success: true };
  } catch (error) {
    if (error instanceof WorkspacePermissionDeniedError)
      return {
        error: "You do not have permission to change limits.",
        success: false,
      };
    return {
      error: "The operational limits could not be saved.",
      success: false,
    };
  }
}
