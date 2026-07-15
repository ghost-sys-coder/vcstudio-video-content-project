import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { workspaceMembers, workspaces } from "@/db/schema";

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
