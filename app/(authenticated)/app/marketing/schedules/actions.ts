"use server";

import { revalidatePath } from "next/cache";
import {
  saveMarketingScheduleRule,
  setMarketingScheduleRuleEnabled,
} from "@/db/commands/marketing-schedule-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  marketingScheduleRuleFormSchema,
  marketingScheduleRuleIdSchema,
} from "@/lib/schemas/marketing-schedule";

export type MarketingScheduleActionResult =
  { ok: true } | { ok: false; error: string };

function timeToMinutes(value: FormDataEntryValue | null) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export async function saveMarketingScheduleRuleAction(
  formData: FormData,
): Promise<MarketingScheduleActionResult> {
  const parsed = marketingScheduleRuleFormSchema.safeParse({
    ...Object.fromEntries(formData),
    platforms: formData.getAll("platforms").map(String),
    byWeekday: formData.getAll("byWeekday").map(String),
    timeOfDayMinutes: timeToMinutes(formData.get("timeOfDay")),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That rule is not valid.",
    };
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) return { ok: false, error: "Workspace unavailable." };
    requireCapability(
      context.activeMembership.role,
      "manageMarketingSchedules",
    );
    const rule = await saveMarketingScheduleRule({
      workspaceId: context.activeMembership.workspaceId,
      createdByUserId: context.user.id,
      rule: parsed.data,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "limits_changed",
      targetType: "marketing_schedule_rule",
      targetId: rule.id,
      metadata: {
        scope: "marketing_schedule",
        frequency: rule.frequency,
        maxItemsPerRun: rule.maxItemsPerRun,
        monthlyBudgetCents: rule.monthlyBudgetCents,
      },
    });
    revalidatePath("/app/marketing");
    revalidatePath("/app/marketing/schedules");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof WorkspacePermissionDeniedError
          ? "Only a workspace owner can manage recurring rules."
          : "That recurring rule could not be saved.",
    };
  }
}

export async function toggleMarketingScheduleRuleAction(
  formData: FormData,
): Promise<MarketingScheduleActionResult> {
  const parsed = marketingScheduleRuleIdSchema.safeParse({
    ruleId: formData.get("ruleId"),
  });
  if (!parsed.success) return { ok: false, error: "That rule is invalid." };
  const enabled = formData.get("enabled") === "true";
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) return { ok: false, error: "Workspace unavailable." };
    requireCapability(
      context.activeMembership.role,
      "manageMarketingSchedules",
    );
    await setMarketingScheduleRuleEnabled({
      workspaceId: context.activeMembership.workspaceId,
      ruleId: parsed.data.ruleId,
      enabled,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "limits_changed",
      targetType: "marketing_schedule_rule",
      targetId: parsed.data.ruleId,
      metadata: { scope: "marketing_schedule", enabled },
    });
    revalidatePath("/app/marketing");
    revalidatePath("/app/marketing/schedules");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof WorkspacePermissionDeniedError
          ? "Only a workspace owner can manage recurring rules."
          : "That rule could not be updated.",
    };
  }
}
