import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { workspaces } from "@/db/schema";

export async function updateWorkspaceName(input: {
  workspaceId: string;
  name: string;
}) {
  const [workspace] = await getDatabase()
    .update(workspaces)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(workspaces.id, input.workspaceId))
    .returning();

  if (!workspace) throw new Error("Workspace update returned no record.");
  return workspace;
}
