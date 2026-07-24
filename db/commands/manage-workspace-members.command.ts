import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  workspaceInvitations,
  workspaceMembers,
  type WorkspaceRole,
} from "@/db/schema";
import {
  countWorkspaceOwners,
  findWorkspaceInvitationById,
} from "@/db/repositories/workspaces.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import {
  LastWorkspaceOwnerError,
  WorkspaceInvitationEmailMismatchError,
  WorkspaceInvitationNotFoundError,
} from "@/lib/domain/errors";
import { getPublishingWebEnvironment } from "@/lib/env/server";

const INVITATION_EXPIRY_DAYS = 30;

export async function inviteWorkspaceMember(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: string;
}) {
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  const { APP_BASE_URL } = getPublishingWebEnvironment();
  const client = await clerkClient();
  const clerkInvitation = await client.invitations.createInvitation({
    emailAddress: input.email,
    redirectUrl: `${APP_BASE_URL}/invite/${invitationId}/accept`,
    ignoreExisting: true,
  });

  const [, insertedInvitations] = await getDatabase().batch([
    getDatabase()
      .delete(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          eq(workspaceInvitations.email, input.email),
          eq(workspaceInvitations.status, "pending"),
        ),
      ),
    getDatabase()
      .insert(workspaceInvitations)
      .values({
        id: invitationId,
        workspaceId: input.workspaceId,
        email: input.email,
        role: input.role,
        invitedByUserId: input.invitedByUserId,
        clerkInvitationId: clerkInvitation.id,
        expiresAt,
      })
      .returning(),
  ]);

  const invitation = insertedInvitations[0];
  if (!invitation)
    throw new Error("Workspace invitation creation returned no record.");

  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.invitedByUserId,
    action: "member_invited",
    targetType: "workspace_invitation",
    targetId: invitation.id,
    metadata: { email: input.email, role: input.role },
  });

  return invitation;
}

export async function revokeWorkspaceInvitation(input: {
  workspaceId: string;
  invitationId: string;
  actorUserId: string;
}): Promise<void> {
  const invitation = await findWorkspaceInvitationById(input.invitationId);
  if (
    !invitation ||
    invitation.workspaceId !== input.workspaceId ||
    invitation.status !== "pending"
  ) {
    throw new WorkspaceInvitationNotFoundError();
  }

  if (invitation.clerkInvitationId) {
    const client = await clerkClient();
    try {
      await client.invitations.revokeInvitation(invitation.clerkInvitationId);
    } catch {
      // Already accepted/revoked on Clerk's side, or otherwise stale — our
      // own status update below is the real access-control boundary either way.
    }
  }

  await getDatabase()
    .update(workspaceInvitations)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspaceInvitations.id, input.invitationId));

  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "invitation_revoked",
    targetType: "workspace_invitation",
    targetId: input.invitationId,
    metadata: { email: invitation.email },
  });
}

export async function acceptWorkspaceInvitation(input: {
  invitationId: string;
  userId: string;
  userEmail: string;
}): Promise<string> {
  const invitation = await findWorkspaceInvitationById(input.invitationId);
  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt < new Date()
  ) {
    throw new WorkspaceInvitationNotFoundError();
  }
  if (invitation.email.toLowerCase() !== input.userEmail.toLowerCase()) {
    throw new WorkspaceInvitationEmailMismatchError();
  }

  await getDatabase().batch([
    getDatabase()
      .insert(workspaceMembers)
      .values({
        workspaceId: invitation.workspaceId,
        userId: input.userId,
        role: invitation.role,
      })
      .onConflictDoNothing(),
    getDatabase()
      .update(workspaceInvitations)
      .set({
        status: "accepted",
        acceptedByUserId: input.userId,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workspaceInvitations.id, invitation.id)),
  ]);

  await recordAuditEvent({
    workspaceId: invitation.workspaceId,
    actorUserId: input.userId,
    action: "member_joined",
    targetType: "workspace_member",
    targetId: input.userId,
    metadata: { role: invitation.role },
  });

  return invitation.workspaceId;
}

export async function updateWorkspaceMemberRole(input: {
  workspaceId: string;
  membershipId: string;
  role: WorkspaceRole;
  actorUserId: string;
}): Promise<void> {
  const [membership] = await getDatabase()
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.id, input.membershipId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!membership) throw new Error("Workspace member not found.");

  if (membership.role === "owner" && input.role !== "owner") {
    const ownerCount = await countWorkspaceOwners(input.workspaceId);
    if (ownerCount <= 1) throw new LastWorkspaceOwnerError();
  }

  await getDatabase()
    .update(workspaceMembers)
    .set({ role: input.role, updatedAt: new Date() })
    .where(eq(workspaceMembers.id, input.membershipId));

  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "role_changed",
    targetType: "workspace_member",
    targetId: membership.userId,
    metadata: { previousRole: membership.role, newRole: input.role },
  });
}

export async function removeWorkspaceMember(input: {
  workspaceId: string;
  membershipId: string;
  actorUserId: string;
}): Promise<void> {
  const [membership] = await getDatabase()
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.id, input.membershipId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!membership) throw new Error("Workspace member not found.");

  if (membership.role === "owner") {
    const ownerCount = await countWorkspaceOwners(input.workspaceId);
    if (ownerCount <= 1) throw new LastWorkspaceOwnerError();
  }

  await getDatabase()
    .delete(workspaceMembers)
    .where(eq(workspaceMembers.id, input.membershipId));

  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "member_removed",
    targetType: "workspace_member",
    targetId: membership.userId,
    metadata: { role: membership.role },
  });
}
