import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, mcpOperations } from "@/db/schema";
import type { MediaContentType } from "@/lib/schemas/media-asset";
import type { VerifiedMediaMetadata } from "@/lib/media/media-inspection";
export async function completeMcpGeneratedAsset(input: {
  operationId: string;
  workspaceId: string;
  userId: string;
  kind: "image" | "audio";
  objectKey: string;
  contentType: MediaContentType;
  sizeBytes: number;
  title: string;
  width: number | null;
  height: number | null;
  durationMilliseconds: number | null;
  verifiedMetadata: VerifiedMediaMetadata | null;
  warnings: string[];
  result: Record<string, unknown>;
}) {
  const db = getDatabase();
  await db.batch([
    db
      .insert(mediaAssets)
      .values({
        id: input.operationId,
        workspaceId: input.workspaceId,
        kind: input.kind,
        status: "ready",
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        originalFileName: `generated-${input.kind}`,
        title: input.title,
        width: input.width,
        height: input.height,
        durationMilliseconds: input.durationMilliseconds,
        uploadedByUserId: input.userId,
        inspectionStatus: input.kind === "audio" ? "succeeded" : null,
        verifiedMetadata: input.verifiedMetadata,
        inspectionWarnings: input.warnings,
        inspectedAt: new Date(),
      })
      .onConflictDoNothing(),
    db
      .update(mcpOperations)
      .set({
        status: "succeeded",
        result: {
          ...input.result,
          mediaAssetId: input.operationId,
          href: "/app/social/library",
          completedAt: new Date().toISOString(),
        },
        error: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mcpOperations.id, input.operationId),
          eq(mcpOperations.workspaceId, input.workspaceId),
          eq(mcpOperations.status, "running"),
        ),
      ),
  ]);
}
