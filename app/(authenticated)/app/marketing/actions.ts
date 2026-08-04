"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { resolveMarketingAccess } from "@/lib/marketing/marketing-access";
import { upsertMarketingSettings } from "@/db/commands/marketing-settings-commands";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { marketingSettingsFormSchema } from "@/lib/schemas/marketing-settings";

export type SaveMarketingSettingsResult =
  { ok: true } | { ok: false; error: string };

export async function saveMarketingSettingsAction(
  formData: FormData,
): Promise<SaveMarketingSettingsResult> {
  const parsed = marketingSettingsFormSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Those settings are not valid.",
    };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };

    // Owner-only: autonomy and the marketing spend ceiling both decide what can
    // happen while nobody is present.
    requireCapability(context.activeMembership.role, "manageSettings");

    const access = await resolveMarketingAccess({
      workspaceId: context.activeMembership.workspaceId,
    });
    if (!access.available)
      return {
        ok: false,
        error:
          access.reason === "deployment_disabled"
            ? "The Marketing Studio is not enabled."
            : "The Marketing Studio is switched off for this workspace.",
      };

    await upsertMarketingSettings({
      workspaceId: context.activeMembership.workspaceId,
      updatedByUserId: context.user.id,
      settings: parsed.data,
    });

    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      // Reuses the existing value rather than adding an enum member: this is a
      // limits change — autonomy, an item cap, and a spend ceiling. The
      // `scope` in the metadata is what distinguishes it from the workspace
      // budget form, and it avoids an ALTER TYPE in a table-adding migration.
      action: "limits_changed",
      targetType: "workspace",
      targetId: context.activeMembership.workspaceId,
      metadata: {
        scope: "marketing",
        autonomyLevel: parsed.data.autonomyLevel,
        requireApprovalBeforePublish: parsed.data.requireApprovalBeforePublish,
      },
    });

    revalidatePath("/app/marketing");
    revalidatePath("/app/marketing/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof WorkspacePermissionDeniedError)
      return {
        ok: false,
        error: "Only a workspace owner can change these settings.",
      };
    return { ok: false, error: "Those settings could not be saved." };
  }
}
