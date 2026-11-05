import "server-only";
import { and, eq, desc, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneImageGenerations } from "@/db/schema";
export async function findApprovedSceneVideoReference(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  generationId?: string;
}) {
  const [row] = await getDatabase()
    .select({
      id: sceneImageGenerations.id,
      objectKey: sceneImageGenerations.assetObjectKey,
      contentType: sceneImageGenerations.assetContentType,
      sizeBytes: sceneImageGenerations.assetSizeBytes,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.sceneVersionId, input.sceneVersionId),
        eq(sceneImageGenerations.status, "succeeded"),
        eq(sceneImageGenerations.reviewStatus, "approved"),
        isNotNull(sceneImageGenerations.assetObjectKey),
        input.generationId
          ? eq(sceneImageGenerations.id, input.generationId)
          : undefined,
      ),
    )
    .orderBy(
      sceneImageGenerations.shotIndex,
      desc(sceneImageGenerations.createdAt),
    )
    .limit(1);
  return row ?? null;
}
