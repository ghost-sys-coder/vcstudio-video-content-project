import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sceneVisualSelectionSchema } from "@studio/contracts/video";
import { authorizeVideoWorkspace } from "./video-generation-service";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { findProject } from "@/db/repositories/projects.repository";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { findSceneVisualSelection } from "@/db/repositories/scene-visual-selections.repository";
import { appendSceneVisualSelection } from "@/db/commands/scene-visual-selection-command";
import { VideoOperationError } from "@/db/commands/video-generation-commands";
import { copyProjectVideo } from "@/lib/storage/copy-project-video";
import {
  deleteMediaAssetObject,
  createMediaAssetDownloadUrl,
} from "@/lib/storage/media-asset-storage";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import type { SceneVisualSelection } from "@/db/schema";

const scopeSchema = z
  .object({ projectId: z.uuid(), sceneId: z.uuid() })
  .strict();
async function sceneContext(
  workspaceId: unknown,
  value: unknown,
  write = false,
) {
  const context = await authorizeVideoWorkspace(workspaceId, write);
  return authorizedSceneContext(context, value);
}
async function authorizedSceneContext(
  context: { workspaceId: string; userId: string },
  value: unknown,
) {
  const scope = scopeSchema.parse(value);
  const [project, current] = await Promise.all([
    findProject({ ...context, projectId: scope.projectId }),
    findCurrentScene({ ...context, ...scope }),
  ]);
  if (!project || project.archivedAt || !current)
    throw new VideoOperationError(
      "not_found",
      "The active project scene was not found.",
    );
  return { ...context, ...scope, project, current };
}
export function sceneVideoSelectionView(
  selection: SceneVisualSelection | null,
) {
  return selection
    ? {
        id: selection.id,
        kind: selection.kind,
        sourceAssetId: selection.sourceAssetId,
        width: selection.width,
        height: selection.height,
        durationMilliseconds: selection.durationMilliseconds,
        fit: selection.fit,
        trimStartMilliseconds: selection.trimStartMilliseconds,
        loop: selection.loop,
        reviewStatus: selection.reviewStatus,
        revision: selection.revision,
      }
    : null;
}
export async function loadSceneVideoView(workspaceId: unknown, value: unknown) {
  const context = await sceneContext(workspaceId, value);
  return loadAuthorizedSceneVideoView(context, value);
}
export async function loadAuthorizedSceneVideoView(
  auth: { workspaceId: string; userId: string },
  value: unknown,
) {
  const context = await authorizedSceneContext(auth, value);
  const selection = await findSceneVisualSelection({
    ...context,
    sceneVersionId: context.current.version.id,
  });
  return {
    projectDefault: context.project.defaultVisualMedia,
    sceneVersionId: context.current.version.id,
    sceneVersion: context.current.scene.currentVersion,
    selection: sceneVideoSelectionView(selection),
  };
}
export type SceneVideoView = Awaited<ReturnType<typeof loadSceneVideoView>>;
export async function saveSceneVideoSelection(
  workspaceId: unknown,
  value: unknown,
) {
  return saveAuthorizedSceneVideoSelection(
    await authorizeVideoWorkspace(workspaceId, true),
    value,
  );
}
export async function saveAuthorizedSceneVideoSelection(
  auth: { workspaceId: string; userId: string },
  value: unknown,
) {
  const input = sceneVisualSelectionSchema.parse(value);
  const context = await authorizedSceneContext(auth, {
    projectId: input.projectId,
    sceneId: input.sceneId,
  });
  const id = randomUUID();
  let objectKey: string | null = null;
  let width: number | null = null,
    height: number | null = null,
    durationMilliseconds: number | null = null;
  if (input.sceneVersionId !== context.current.version.id)
    throw new VideoOperationError(
      "scene_changed",
      "The scene changed. Refresh before saving.",
    );
  if (input.kind === "video") {
    if (!input.assetId)
      throw new VideoOperationError(
        "missing_video",
        "Choose a ready library video first.",
      );
    const asset = await findMediaAsset({
      ...context,
      mediaAssetId: input.assetId,
    });
    const metadata = asset?.verifiedMetadata;
    if (
      !asset ||
      asset.deletedAt ||
      asset.status !== "ready" ||
      asset.kind !== "video" ||
      asset.inspectionStatus !== "succeeded" ||
      metadata?.kind !== "video"
    )
      throw new VideoOperationError(
        "video_unverified",
        "Only inspected, ready library videos can be used in a scene.",
      );
    width = metadata.displayWidth;
    height = metadata.displayHeight;
    durationMilliseconds = metadata.durationMilliseconds;
    if (input.trimStartMilliseconds >= durationMilliseconds - 100)
      throw new VideoOperationError(
        "invalid_trim",
        "Start time must leave usable footage in the clip.",
      );
    objectKey = `workspaces/${context.workspaceId}/projects/${context.projectId}/scenes/${context.sceneId}/versions/${input.sceneVersionId}/clips/${id}.mp4`;
    await copyProjectVideo({
      sourceKey: asset.objectKey,
      destinationKey: objectKey,
    });
  }
  try {
    await appendSceneVisualSelection({
      ...context,
      sceneVersionId: input.sceneVersionId,
      expectedSceneVersion: context.current.scene.currentVersion,
      expectedRevision: input.expectedRevision,
      selection: {
        id,
        kind: input.kind,
        sourceAssetId: input.assetId,
        objectKey,
        width,
        height,
        durationMilliseconds,
        fit: input.fit,
        trimStartMilliseconds: input.trimStartMilliseconds,
        loop: input.loop,
        reviewStatus: "pending",
      },
    });
  } catch (error) {
    if (objectKey)
      await deleteMediaAssetObject(objectKey).catch(() => {
        console.error("Uncommitted scene video copy needs cleanup", {
          assignmentId: id,
        });
      });
    throw error;
  }
  return loadAuthorizedSceneVideoView(context, {
    projectId: input.projectId,
    sceneId: input.sceneId,
  });
}
export async function reviewSceneVideoSelection(
  workspaceId: unknown,
  value: unknown,
) {
  return reviewAuthorizedSceneVideoSelection(
    await authorizeVideoWorkspace(workspaceId, true),
    value,
  );
}
export async function reviewAuthorizedSceneVideoSelection(
  auth: { workspaceId: string; userId: string },
  value: unknown,
) {
  const input = scopeSchema
    .extend({
      expectedRevision: z.number().int().positive(),
      reviewStatus: z.enum(["approved", "rejected"]),
    })
    .parse(value);
  const context = await authorizedSceneContext(auth, {
    projectId: input.projectId,
    sceneId: input.sceneId,
  });
  const current = await findSceneVisualSelection({
    ...context,
    sceneVersionId: context.current.version.id,
  });
  if (
    !current ||
    current.kind !== "video" ||
    current.revision !== input.expectedRevision
  )
    throw new VideoOperationError(
      "scene_changed",
      "The footage changed. Refresh it before reviewing.",
    );
  const id = randomUUID();
  await appendSceneVisualSelection({
    ...context,
    sceneVersionId: current.sceneVersionId,
    expectedSceneVersion: context.current.scene.currentVersion,
    expectedRevision: current.revision,
    selection: { ...current, id, reviewStatus: input.reviewStatus },
  });
  await recordAuditEvent({
    ...context,
    actorUserId: context.userId,
    action: "asset_approved",
    targetType: "scene_video_selection",
    targetId: id,
    metadata: {
      reviewStatus: input.reviewStatus,
      sourceAssetId: current.sourceAssetId,
    },
  });
  return loadAuthorizedSceneVideoView(context, {
    projectId: input.projectId,
    sceneId: input.sceneId,
  });
}
export async function sceneVideoPreviewUrl(
  workspaceId: unknown,
  value: unknown,
) {
  const context = await sceneContext(workspaceId, value);
  const selection = await findSceneVisualSelection({
    ...context,
    sceneVersionId: context.current.version.id,
  });
  if (!selection?.objectKey)
    throw new VideoOperationError("missing_video", "Choose a video first.");
  return createMediaAssetDownloadUrl(selection.objectKey, 300);
}
