"use server";

import { revalidatePath } from "next/cache";
import { disconnectPlatformConnection } from "@/db/commands/platform-connection-commands";
import { updateWorkspaceName } from "@/db/commands/update-workspace.command";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import {
  getAuthenticatedWorkspaceContext,
  requireWorkspaceMembership,
} from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { disconnectPlatformSchema } from "@/lib/schemas/publishing";
import { updateWorkspaceProfileSchema } from "@/lib/schemas/workspace";

export type UpdateWorkspaceProfileState = {
  error: string | null;
  success: boolean;
};

export type DisconnectWorkspaceChannelState = {
  error: string | null;
  success: boolean;
};

export async function disconnectWorkspaceChannelAction(
  formData: FormData,
): Promise<DisconnectWorkspaceChannelState> {
  const parsed = disconnectPlatformSchema.safeParse({
    connectionId: formData.get("connectionId"),
  });
  if (!parsed.success)
    return { error: "The channel request is invalid.", success: false };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
    requireCapability(context.activeMembership.role, "manageSettings");
    const result = await disconnectPlatformConnection({
      connectionId: parsed.data.connectionId,
      workspaceId: context.activeMembership.workspaceId,
    });
    if (!result.disconnected)
      return { error: "That channel could not be found.", success: false };

    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "platform_disconnected",
      targetType: "platform_connection",
      targetId: parsed.data.connectionId,
    });
    revalidatePath("/app/settings/workspace");
    return { error: null, success: true };
  } catch {
    return {
      error: "The channel could not be disconnected.",
      success: false,
    };
  }
}

export async function updateWorkspaceProfileAction(
  formData: FormData,
): Promise<UpdateWorkspaceProfileState> {
  const parsed = updateWorkspaceProfileSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid workspace profile.",
      success: false,
    };
  }

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageSettings");
    await updateWorkspaceName(parsed.data);
    revalidatePath("/app", "layout");
    return { error: null, success: true };
  } catch {
    return {
      error: "The workspace profile could not be updated.",
      success: false,
    };
  }
}
