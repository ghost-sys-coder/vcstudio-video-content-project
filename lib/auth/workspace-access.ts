import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import { WorkspaceAccessDeniedError } from "@/lib/domain/errors";

export type MembershipLookup = (input: {
  userId: string;
  workspaceId: string;
}) => Promise<WorkspaceMembershipView | null>;

export async function resolveRequiredWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
  lookup: MembershipLookup;
}): Promise<WorkspaceMembershipView> {
  const membership = await input.lookup({
    userId: input.userId,
    workspaceId: input.workspaceId,
  });

  if (!membership) {
    throw new WorkspaceAccessDeniedError();
  }

  return membership;
}
