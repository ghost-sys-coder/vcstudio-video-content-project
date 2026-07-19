import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projectBriefs, type ProjectBrief } from "@/db/schema";

export async function findProjectBrief(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ProjectBrief | null> {
  const [brief] = await getDatabase()
    .select()
    .from(projectBriefs)
    .where(
      and(
        eq(projectBriefs.workspaceId, input.workspaceId),
        eq(projectBriefs.projectId, input.projectId),
      ),
    )
    .limit(1);
  return brief ?? null;
}
