"use server";

import { revalidatePath } from "next/cache";
import {
  archiveChannelProfile,
  assignProjectChannel,
  ChannelProfileNotFoundError,
  createChannelProfile,
  updateChannelProfile,
} from "@/db/commands/channel-profile-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  archiveChannelProfileSchema,
  assignProjectChannelSchema,
  createChannelProfileSchema,
  updateChannelProfileSchema,
} from "@/lib/schemas/channel-profile";

export type ChannelActionState = { error: string | null; success: boolean };

const FAILURE = (error: string): ChannelActionState => ({
  error,
  success: false,
});

/**
 * Resolves the caller's workspace and refuses the action unless their role
 * permits managing channels. Channel identity is a workspace-level production
 * decision, so it is owner-only, matching custom voices.
 */
async function requireChannelManagement() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new ChannelProfileNotFoundError();
  requireCapability(context.activeMembership.role, "manageChannelProfiles");
  return context;
}

export async function createChannelProfileAction(
  formData: FormData,
): Promise<ChannelActionState> {
  const parsed = createChannelProfileSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return FAILURE(parsed.error.issues[0]?.message ?? "Invalid channel.");
  try {
    const context = await requireChannelManagement();
    const created = await createChannelProfile({
      workspaceId: context.activeMembership.workspaceId,
      createdByUserId: context.user.id,
      values: parsed.data,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "channel_profile_created",
      targetType: "channel_profile",
      targetId: created.id,
      metadata: { platform: created.platform },
    });
  } catch {
    return FAILURE("The channel could not be created.");
  }
  revalidatePath("/app/settings/workspace");
  return { error: null, success: true };
}

export async function updateChannelProfileAction(
  formData: FormData,
): Promise<ChannelActionState> {
  const parsed = updateChannelProfileSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return FAILURE(parsed.error.issues[0]?.message ?? "Invalid channel.");
  const { channelProfileId, ...values } = parsed.data;
  try {
    const context = await requireChannelManagement();
    await updateChannelProfile({
      workspaceId: context.activeMembership.workspaceId,
      channelProfileId,
      values,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "channel_profile_updated",
      targetType: "channel_profile",
      targetId: channelProfileId,
      metadata: {},
    });
  } catch (error) {
    return FAILURE(
      error instanceof ChannelProfileNotFoundError
        ? error.message
        : "The channel could not be updated.",
    );
  }
  revalidatePath("/app/settings/workspace");
  return { error: null, success: true };
}

export async function archiveChannelProfileAction(
  formData: FormData,
): Promise<ChannelActionState> {
  const parsed = archiveChannelProfileSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return FAILURE("The channel is invalid.");
  try {
    const context = await requireChannelManagement();
    await archiveChannelProfile({
      workspaceId: context.activeMembership.workspaceId,
      channelProfileId: parsed.data.channelProfileId,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "channel_profile_archived",
      targetType: "channel_profile",
      targetId: parsed.data.channelProfileId,
      metadata: {},
    });
  } catch (error) {
    return FAILURE(
      error instanceof ChannelProfileNotFoundError
        ? error.message
        : "The channel could not be archived.",
    );
  }
  revalidatePath("/app/settings/workspace");
  return { error: null, success: true };
}

/**
 * Moves one project between channels, or back to unassigned. Editors may do
 * this because it is a per-project production decision, unlike defining the
 * channel itself.
 */
export async function assignProjectChannelAction(
  formData: FormData,
): Promise<ChannelActionState> {
  const parsed = assignProjectChannelSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return FAILURE("The channel selection is invalid.");
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) return FAILURE("Workspace access is required.");
    requireCapability(context.activeMembership.role, "mutateWorkspaceData");
    const project = await findProject({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
    });
    if (!project || project.status === "archived")
      return FAILURE("The project is unavailable.");
    await assignProjectChannel({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      channelProfileId: parsed.data.channelProfileId || null,
    });
  } catch (error) {
    return FAILURE(
      error instanceof ChannelProfileNotFoundError
        ? error.message
        : "The project channel could not be changed.",
    );
  }
  revalidatePath(`/app/projects/${parsed.data.projectId}/settings`);
  return { error: null, success: true };
}
