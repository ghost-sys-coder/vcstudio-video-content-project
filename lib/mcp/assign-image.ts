import "server-only";
import { mcpSceneImageFramingSchema } from "@studio/contracts";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { listProjectOutputVariants } from "@/db/repositories/output-variants.repository";
import { saveSceneVariantFraming } from "@/db/commands/output-variant-commands";
import { saveUploadedSceneImage } from "@/db/commands/scene-image-commands";
import { addMcpAssetOrigin } from "@/db/repositories/mcp.repository";
import { createSceneImageObjectKey } from "@/lib/storage/object-key";
import { downloadMediaAssetBytes } from "@/lib/storage/media-asset-storage";
import { putMcpSceneImage } from "@/lib/storage/mcp-scene-image";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
import type { McpContext } from "./context";
import { requireMcpProject } from "./project-access";
import { mutateOnce } from "./operations";
import { requireMcp } from "./errors";
import { fitImportedImage } from "./fit-image";

export async function assignMcpImage(
  context: McpContext,
  key: string,
  input: {
    projectId: string;
    sceneId: string;
    expectedVersion: number;
    mediaAssetId: string;
    fit: "contain" | "cover";
    shotIndex: number;
  },
) {
  const project = await requireMcpProject(
    context,
    input.projectId,
    "generateSceneImages",
  );
  return mutateOnce(
    context,
    "assign_image",
    key,
    input,
    async (operationId) => {
      const [asset, current] = await Promise.all([
        findMediaAsset({
          workspaceId: context.workspaceId,
          mediaAssetId: input.mediaAssetId,
        }),
        findCurrentScene({
          workspaceId: context.workspaceId,
          projectId: input.projectId,
          sceneId: input.sceneId,
        }),
      ]);
      requireMcp(
        asset?.status === "ready" &&
          !asset.deletedAt &&
          asset.kind === "image" &&
          ["image/png", "image/jpeg", "image/webp"].includes(asset.contentType),
        "unsupported_media",
        "Choose a verified PNG, JPEG or WebP library image.",
      );
      requireMcp(
        current?.scene.currentVersion === input.expectedVersion &&
          current.scene.status === "approved",
        "conflict",
        "Approve the current scene version before assigning an image.",
      );
      const variants = await listProjectOutputVariants({
        workspaceId: context.workspaceId,
        projectId: project.id,
      });
      const target = variants.find(
        (v) => v.aspectRatio === project.aspectRatio,
      );
      requireMcp(
        target,
        "not_found",
        "The project's output format is unavailable.",
      );
      const size = getSceneImageSizeForAspectRatio(project.aspectRatio);
      const bytes = await fitImportedImage(
        await downloadMediaAssetBytes(asset.objectKey),
        size,
        input.fit,
      );
      const objectKey = createSceneImageObjectKey({
        workspaceId: context.workspaceId,
        projectId: project.id,
        sceneId: input.sceneId,
        sceneVersionId: current.version.id,
        generationId: operationId,
        outputFormat: "png",
      });
      const etag = await putMcpSceneImage(objectKey, bytes);
      const [width, height] = size.split("x").map(Number);
      const created = await saveUploadedSceneImage({
        workspaceId: context.workspaceId,
        projectId: project.id,
        sceneId: input.sceneId,
        sceneVersionId: current.version.id,
        generationId: operationId,
        size,
        shotIndex: input.shotIndex,
        objectKey,
        contentType: "image/png",
        sizeBytes: bytes.byteLength,
        width,
        height,
        etag,
        requestedByUserId: context.principal.userId,
      });
      const framing = await saveSceneVariantFraming({
        workspaceId: context.workspaceId,
        projectId: project.id,
        outputVariantId: target.id,
        sceneId: input.sceneId,
        sceneVersionId: current.version.id,
        sourceImageGenerationId: created.id,
        mode: "contain",
        focalPointXBps: 5000,
        focalPointYBps: 5000,
        scaleBps: 10000,
        backgroundColor: "#000000",
        updatedByUserId: context.principal.userId,
      });
      await addMcpAssetOrigin({
        workspaceId: context.workspaceId,
        operationId,
        mediaAssetId: asset.id,
        sceneImageId: created.id,
        attribution: "Assigned from workspace media library",
      });
      return {
        generationId: created.id,
        reviewStatus: "pending",
        importFit: input.fit,
        sourceMediaAssetId: asset.id,
        image: { size, width, height },
        outputFraming: mcpSceneImageFramingSchema.parse({
          ...framing,
          aspectRatio: target.aspectRatio,
          outputWidth: target.width,
          outputHeight: target.height,
        }),
        href: `/app/projects/${project.id}/scenes?sceneId=${input.sceneId}`,
      };
    },
  );
}
