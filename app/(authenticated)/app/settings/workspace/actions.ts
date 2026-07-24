"use server";

import { revalidatePath } from "next/cache";
import { updateWorkspaceName } from "@/db/commands/update-workspace.command";
import {
  inviteWorkspaceMember,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
} from "@/db/commands/manage-workspace-members.command";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import {
  getAuthenticatedWorkspaceContext,
  requireWorkspaceMembership,
} from "@/lib/auth/workspace-context";
import { LastWorkspaceOwnerError } from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { disconnectPlatformAuthorization } from "@/lib/publishing/disconnect-platform-connection";
import { disconnectPlatformSchema } from "@/lib/schemas/publishing";
import {
  inviteWorkspaceMemberSchema,
  removeWorkspaceMemberSchema,
  revokeWorkspaceInvitationSchema,
  updateWorkspaceMemberRoleSchema,
  updateWorkspaceProfileSchema,
} from "@/lib/schemas/workspace";

export type UpdateWorkspaceProfileState = {
  error: string | null;
  success: boolean;
};

export type DisconnectWorkspaceChannelState = {
  error: string | null;
  success: boolean;
};

export type ManageWorkspaceMembersState = {
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
    const result = await disconnectPlatformAuthorization({
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

export async function inviteWorkspaceMemberAction(
  formData: FormData,
): Promise<ManageWorkspaceMembersState> {
  const parsed = inviteWorkspaceMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid invitation.",
      success: false,
    };
  }

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageMembers");
    await inviteWorkspaceMember({
      workspaceId: parsed.data.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedByUserId: user.id,
    });
    revalidatePath("/app/settings/workspace");
    return { error: null, success: true };
  } catch {
    return { error: "The invitation could not be sent.", success: false };
  }
}

export async function revokeWorkspaceInvitationAction(
  formData: FormData,
): Promise<ManageWorkspaceMembersState> {
  const parsed = revokeWorkspaceInvitationSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success)
    return { error: "The invitation request is invalid.", success: false };

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageMembers");
    await revokeWorkspaceInvitation({
      workspaceId: parsed.data.workspaceId,
      invitationId: parsed.data.invitationId,
      actorUserId: user.id,
    });
    revalidatePath("/app/settings/workspace");
    return { error: null, success: true };
  } catch {
    return {
      error: "The invitation could not be revoked.",
      success: false,
    };
  }
}

export async function updateWorkspaceMemberRoleAction(
  formData: FormData,
): Promise<ManageWorkspaceMembersState> {
  const parsed = updateWorkspaceMemberRoleSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success)
    return { error: "The role change request is invalid.", success: false };

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageMembers");
    await updateWorkspaceMemberRole({
      workspaceId: parsed.data.workspaceId,
      membershipId: parsed.data.membershipId,
      role: parsed.data.role,
      actorUserId: user.id,
    });
    revalidatePath("/app/settings/workspace");
    return { error: null, success: true };
  } catch (error) {
    if (error instanceof LastWorkspaceOwnerError)
      return { error: error.message, success: false };
    return { error: "The role could not be changed.", success: false };
  }
}

export async function removeWorkspaceMemberAction(
  formData: FormData,
): Promise<ManageWorkspaceMembersState> {
  const parsed = removeWorkspaceMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success)
    return { error: "The removal request is invalid.", success: false };

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageMembers");
    await removeWorkspaceMember({
      workspaceId: parsed.data.workspaceId,
      membershipId: parsed.data.membershipId,
      actorUserId: user.id,
    });
    revalidatePath("/app/settings/workspace");
    return { error: null, success: true };
  } catch (error) {
    if (error instanceof LastWorkspaceOwnerError)
      return { error: error.message, success: false };
    return { error: "The member could not be removed.", success: false };
  }
}
