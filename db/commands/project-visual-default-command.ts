import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projects } from "@/db/schema";
export async function updateProjectVisualDefault(input: {
  workspaceId: string;
  projectId: string;
  expectedUpdatedAt: Date;
  kind: "image" | "video";
}) {
  const [row] = await getDatabase()
    .update(projects)
    .set({ defaultVisualMedia: input.kind, updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.updatedAt, input.expectedUpdatedAt),
        isNull(projects.archivedAt),
      ),
    )
    .returning({ updatedAt: projects.updatedAt });
  return row ?? null;
}
