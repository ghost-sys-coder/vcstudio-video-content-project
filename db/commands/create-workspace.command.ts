import "server-only";

import { getDatabase } from "@/db/drizzle";
import { workspaceMembers, workspaces } from "@/db/schema";

function createWorkspaceSlug(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const suffix = crypto.randomUUID().slice(0, 8);
  return `${normalized || "workspace"}-${suffix}`;
}

export async function createOwnedWorkspace(input: {
  userId: string;
  name: string;
}) {
  const workspaceId = crypto.randomUUID();
  const [createdWorkspaces] = await getDatabase().batch([
    getDatabase()
      .insert(workspaces)
      .values({
        id: workspaceId,
        name: input.name,
        slug: createWorkspaceSlug(input.name),
        createdByUserId: input.userId,
      })
      .returning(),
    getDatabase().insert(workspaceMembers).values({
      workspaceId,
      userId: input.userId,
      role: "owner",
    }),
  ]);

  const workspace = createdWorkspaces[0];

  if (!workspace) {
    throw new Error("Workspace creation returned no workspace record.");
  }

  return workspace;
}
