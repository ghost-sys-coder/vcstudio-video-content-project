import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import {
  findWorkspaceMembership,
  listWorkspaceMemberships,
  type WorkspaceMembershipView,
} from "@/db/repositories/workspaces.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { resolveRequiredWorkspaceMembership } from "@/lib/auth/workspace-access";
import { selectWorkspaceSchema } from "@/lib/schemas/workspace";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export type AuthenticatedWorkspaceContext = {
  user: Awaited<ReturnType<typeof requireAuthenticatedUser>>;
  memberships: WorkspaceMembershipView[];
  activeMembership: WorkspaceMembershipView;
};

export const getAuthenticatedWorkspaceContext = cache(
  async (): Promise<AuthenticatedWorkspaceContext | null> => {
    const user = await requireAuthenticatedUser();
    const memberships = await listWorkspaceMemberships(user.id);

    if (memberships.length === 0) {
      return null;
    }

    const cookieStore = await cookies();
    const requestedWorkspaceId = cookieStore.get(
      ACTIVE_WORKSPACE_COOKIE,
    )?.value;
    const parsedWorkspaceId = selectWorkspaceSchema.safeParse({
      workspaceId: requestedWorkspaceId,
    });
    const activeMembership = parsedWorkspaceId.success
      ? await findWorkspaceMembership({
          userId: user.id,
          workspaceId: parsedWorkspaceId.data.workspaceId,
        })
      : memberships[0];

    return {
      user,
      memberships,
      activeMembership: activeMembership ?? memberships[0]!,
    };
  },
);

export async function requireWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}): Promise<WorkspaceMembershipView> {
  return resolveRequiredWorkspaceMembership({
    ...input,
    lookup: findWorkspaceMembership,
  });
}
