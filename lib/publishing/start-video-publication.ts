import "server-only";

import { tasks } from "@trigger.dev/sdk";
import type { Project } from "@/db/schema";
import {
  attachVideoPublicationTriggerRun,
  createVideoPublication,
  failVideoPublication,
} from "@/db/commands/video-publication-commands";
import {
  countActivePublicationsForRender,
  findActivePlatformConnection,
  findVideoPublicationByIdempotencyKey,
} from "@/db/repositories/publishing.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import { createVideoPublicationIdempotencyKey } from "@/lib/domain/idempotency";
import {
  getPublishingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { isPublishablePlatform } from "@/lib/publishing/provider-registry";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type { PublishVideoInput } from "@/lib/schemas/publishing";
import type { videoPublishTask } from "@/trigger/video-publish";

export class VideoPublicationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoPublicationRequestError";
  }
}

/**
 * Validate a publish request end to end, then dispatch the durable upload.
 *
 * Everything that can be known before touching the platform is checked here —
 * the render exists, succeeded, and has a stored asset within the size ceiling;
 * the connection is live and belongs to this workspace; the same render is not
 * already on its way to the same account.
 */
export async function startVideoPublication(input: {
  workspaceId: string;
  project: Project;
  request: PublishVideoInput;
  requestedByUserId: string;
}): Promise<{ publicationId: string; created: boolean }> {
  const environment = getPublishingEnvironment();
  if (!environment.ENABLE_VIDEO_PUBLISHING)
    throw new VideoPublicationRequestError("Publishing is disabled.");
  if (!isPublishablePlatform(input.request.platform))
    throw new VideoPublicationRequestError(
      "Publishing to that platform is not available yet.",
    );

  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "video_publication",
  });

  const render = await findVideoRender({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    renderId: input.request.renderId,
  });
  if (!render)
    throw new VideoPublicationRequestError("That render no longer exists.");
  if (render.status !== "succeeded" || !render.assetObjectKey)
    throw new VideoPublicationRequestError(
      "Only a finished render can be published.",
    );
  const sizeBytes = render.assetSizeBytes ?? 0;
  if (sizeBytes <= 0)
    throw new VideoPublicationRequestError(
      "That render has no downloadable video.",
    );
  if (sizeBytes > environment.MAX_PUBLISH_VIDEO_BYTES)
    throw new VideoPublicationRequestError(
      "That render is too large to publish.",
    );

  const connection = await findActivePlatformConnection({
    workspaceId: input.workspaceId,
    platform: input.request.platform,
  });
  if (!connection || connection.id !== input.request.connectionId)
    throw new VideoPublicationRequestError(
      "Connect the account again before publishing.",
    );

  const alreadyPublishing = await countActivePublicationsForRender({
    workspaceId: input.workspaceId,
    renderId: render.id,
    connectionId: connection.id,
  });
  if (alreadyPublishing > 0)
    throw new VideoPublicationRequestError(
      "This render has already been published to that account.",
    );

  const idempotencyKey = createVideoPublicationIdempotencyKey({
    secret: getSceneAnalysisEnvironment().IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    renderId: render.id,
    connectionId: connection.id,
    platform: input.request.platform,
    requestNonce: input.request.requestNonce,
  });
  const existing = await findVideoPublicationByIdempotencyKey(idempotencyKey);
  if (existing) return { publicationId: existing.id, created: false };

  const publicationId = crypto.randomUUID();
  await createVideoPublication({
    id: publicationId,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    renderId: render.id,
    connectionId: connection.id,
    platform: input.request.platform,
    title: input.request.title,
    description: input.request.description,
    tags: input.request.tags,
    visibility: input.request.visibility,
    idempotencyKey,
    requestedByUserId: input.requestedByUserId,
  });

  try {
    const handle = await tasks.trigger<typeof videoPublishTask>(
      "video-publish",
      {
        publicationId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      },
      { idempotencyKey },
    );
    await attachVideoPublicationTriggerRun({
      publicationId,
      triggerRunId: handle.id,
    });
  } catch (error) {
    await failVideoPublication({
      publicationId,
      category: "dispatch_failed",
      message: "Publishing could not be queued.",
    });
    throw error;
  }

  return { publicationId, created: true };
}
