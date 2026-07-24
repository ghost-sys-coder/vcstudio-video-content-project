import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  type WorkspaceRole,
} from "@/db/schema";

export type WorkspaceMembershipView = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: "owner" | "editor" | "viewer";
};

export async function listWorkspaceMemberships(
  userId: string,
): Promise<WorkspaceMembershipView[]> {
  return getDatabase()
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.name));
}

export async function findWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}): Promise<WorkspaceMembershipView | null> {
  const [membership] = await getDatabase()
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);

  return membership ?? null;
}

export type WorkspaceMemberView = {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: Date;
};

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberView[]> {
  return getDatabase()
    .select({
      membershipId: workspaceMembers.id,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.displayName));
}

export async function countWorkspaceOwners(
  workspaceId: string,
): Promise<number> {
  const owners = await getDatabase()
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "owner"),
      ),
    );

  return owners.length;
}

export type WorkspaceInvitationView = {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedByDisplayName: string;
  createdAt: Date;
  expiresAt: Date;
};

export async function listPendingWorkspaceInvitations(
  workspaceId: string,
): Promise<WorkspaceInvitationView[]> {
  return getDatabase()
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      invitedByDisplayName: users.displayName,
      createdAt: workspaceInvitations.createdAt,
      expiresAt: workspaceInvitations.expiresAt,
    })
    .from(workspaceInvitations)
    .innerJoin(users, eq(workspaceInvitations.invitedByUserId, users.id))
    .where(
      and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.status, "pending"),
      ),
    )
    .orderBy(asc(workspaceInvitations.createdAt));
}

export async function findWorkspaceInvitationById(invitationId: string) {
  const [invitation] = await getDatabase()
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.id, invitationId))
    .limit(1);

  return invitation ?? null;
}

export type WorkspaceInvitationAcceptanceView = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: (typeof workspaceInvitations.$inferSelect)["status"];
  expiresAt: Date;
  workspaceId: string;
  workspaceName: string;
};

export async function findWorkspaceInvitationForAcceptance(
  invitationId: string,
): Promise<WorkspaceInvitationAcceptanceView | null> {
  const [invitation] = await getDatabase()
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      status: workspaceInvitations.status,
      expiresAt: workspaceInvitations.expiresAt,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
    .where(eq(workspaceInvitations.id, invitationId))
    .limit(1);

  return invitation ?? null;
}
