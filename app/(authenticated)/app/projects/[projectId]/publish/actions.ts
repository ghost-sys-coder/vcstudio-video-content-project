"use server";

import { revalidatePath } from "next/cache";
import {
  cancelThumbnailGeneration,
  dismissThumbnailGeneration,
  setThumbnailFavorite,
} from "@/db/commands/thumbnail-generation-commands";
import { findThumbnailGeneration } from "@/db/repositories/thumbnail-generation.repository";
import { cancelVideoPublication } from "@/db/commands/video-publication-commands";
import {
  loadPublishingView,
  type PublishActionResult,
  type PublishingView,
} from "@/lib/publishing/publishing-view";
import { disconnectPlatformAuthorization } from "@/lib/publishing/disconnect-platform-connection";
import {
  startVideoPublication,
  VideoPublicationRequestError,
} from "@/lib/publishing/start-video-publication";
import {
  cancelPublicationSchema,
  disconnectPlatformSchema,
  publishVideoSchema,
} from "@/lib/schemas/publishing";
import {
  cancelTitleGeneration,
  setTitleSuggestionFavorite,
} from "@/db/commands/title-generation-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  BudgetExceededError,
  RateLimitExceededError,
} from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  startTitleGeneration,
  TitleGenerationRequestError,
} from "@/lib/titles/start-title-generation";
import {
  loadTitlesView,
  type TitleActionResult,
  type TitlesView,
} from "@/lib/titles/title-view";
import {
  cancelTitleGenerationSchema,
  generateTitlesSchema,
  toggleTitleFavoriteSchema,
} from "@/lib/schemas/title-generation";
import {
  cancelThumbnailGenerationSchema,
  dismissThumbnailSchema,
  generateThumbnailSchema,
  regenerateThumbnailSchema,
  toggleThumbnailFavoriteSchema,
} from "@/lib/schemas/thumbnail";
import {
  startThumbnailGeneration,
  ThumbnailGenerationRequestError,
} from "@/lib/thumbnails/start-thumbnail-generation";
import {
  loadThumbnailsView,
  type ThumbnailActionResult,
  type ThumbnailsView,
} from "@/lib/thumbnails/thumbnail-view";

async function requirePublishMutation(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
  requireCapability(context.activeMembership.role, "mutateWorkspaceData");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (project.status === "archived") throw new Error("PROJECT_ARCHIVED");
  return { context, project };
}

export async function generateTitlesAction(
  formData: FormData,
): Promise<TitleActionResult> {
  const parsed = generateTitlesSchema.safeParse({
    projectId: formData.get("projectId"),
    platform: formData.get("platform"),
    requestNonce: formData.get("requestNonce"),
    optionCount: formData.get("optionCount") ?? undefined,
  });
  if (!parsed.success)
    return { success: false, error: "The title request is invalid." };
  try {
    const { context, project } = await requirePublishMutation(
      parsed.data.projectId,
    );
    const brief = await findProjectBrief({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
    });
    await startTitleGeneration({
      workspaceId: context.activeMembership.workspaceId,
      project,
      brief,
      platform: parsed.data.platform,
      optionCount: parsed.data.optionCount,
      requestedByUserId: context.user.id,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof TitleGenerationRequestError)
      return { success: false, error: error.message };
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    if (error instanceof BudgetExceededError)
      return {
        success: false,
        error:
          error.scope === "project"
            ? "This would exceed the project budget."
            : error.scope === "workspace_daily"
              ? "This would exceed the workspace daily budget."
              : "This would exceed the workspace monthly budget.",
      };
    return { success: false, error: "The titles could not be generated." };
  }
}

export async function cancelTitleGenerationAction(
  formData: FormData,
): Promise<TitleActionResult> {
  const parsed = cancelTitleGenerationSchema.safeParse({
    projectId: formData.get("projectId"),
    titleGenerationRunId: formData.get("titleGenerationRunId"),
  });
  if (!parsed.success)
    return { success: false, error: "The cancel request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    const result = await cancelTitleGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      titleGenerationRunId: parsed.data.titleGenerationRunId,
    });
    if (result.cancelled)
      await recordAuditEvent({
        workspaceId: context.activeMembership.workspaceId,
        actorUserId: context.user.id,
        projectId: parsed.data.projectId,
        action: "generation_cancelled",
        targetType: "title_generation",
        targetId: parsed.data.titleGenerationRunId,
      });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The generation could not be cancelled." };
  }
}

export async function toggleTitleFavoriteAction(
  formData: FormData,
): Promise<TitleActionResult> {
  const parsed = toggleTitleFavoriteSchema.safeParse({
    projectId: formData.get("projectId"),
    suggestionId: formData.get("suggestionId"),
    isFavorite: formData.get("isFavorite"),
  });
  if (!parsed.success)
    return { success: false, error: "The request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    await setTitleSuggestionFavorite({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      suggestionId: parsed.data.suggestionId,
      isFavorite: parsed.data.isFavorite === "true",
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The favorite could not be updated." };
  }
}

export async function generateThumbnailAction(
  formData: FormData,
): Promise<ThumbnailActionResult> {
  const parsed = generateThumbnailSchema.safeParse({
    projectId: formData.get("projectId"),
    platform: formData.get("platform"),
    textMode: formData.get("textMode"),
    headlineText: formData.get("headlineText") ?? undefined,
    requestNonce: formData.get("requestNonce"),
  });
  if (!parsed.success)
    return { success: false, error: "The thumbnail request is invalid." };
  try {
    const { context, project } = await requirePublishMutation(
      parsed.data.projectId,
    );
    const brief = await findProjectBrief({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
    });
    await startThumbnailGeneration({
      workspaceId: context.activeMembership.workspaceId,
      project,
      brief,
      platform: parsed.data.platform,
      textMode: parsed.data.textMode,
      headlineText: parsed.data.headlineText,
      requestedByUserId: context.user.id,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof ThumbnailGenerationRequestError)
      return { success: false, error: error.message };
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    if (error instanceof BudgetExceededError)
      return {
        success: false,
        error:
          error.scope === "project"
            ? "This would exceed the project budget."
            : error.scope === "workspace_daily"
              ? "This would exceed the workspace daily budget."
              : "This would exceed the workspace monthly budget.",
      };
    return { success: false, error: "The thumbnail could not be generated." };
  }
}

/**
 * Start a fresh generation reusing a previous one's settings. This is a new
 * billable operation, not a free retry: `transport_ambiguous` failures are
 * classified non-retriable precisely because the provider may already have
 * billed the original call, so re-running is always an explicit user choice.
 */
export async function regenerateThumbnailAction(
  formData: FormData,
): Promise<ThumbnailActionResult> {
  const parsed = regenerateThumbnailSchema.safeParse({
    projectId: formData.get("projectId"),
    thumbnailGenerationId: formData.get("thumbnailGenerationId"),
    requestNonce: formData.get("requestNonce"),
  });
  if (!parsed.success)
    return { success: false, error: "The regenerate request is invalid." };
  try {
    const { context, project } = await requirePublishMutation(
      parsed.data.projectId,
    );
    const workspaceId = context.activeMembership.workspaceId;
    const previous = await findThumbnailGeneration({
      workspaceId,
      projectId: parsed.data.projectId,
      thumbnailGenerationId: parsed.data.thumbnailGenerationId,
    });
    if (!previous)
      return { success: false, error: "That thumbnail no longer exists." };

    const brief = await findProjectBrief({
      workspaceId,
      projectId: parsed.data.projectId,
    });
    await startThumbnailGeneration({
      workspaceId,
      project,
      brief,
      platform: previous.platform,
      textMode: previous.textMode,
      headlineText: previous.headlineText ?? "",
      requestedByUserId: context.user.id,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof ThumbnailGenerationRequestError)
      return { success: false, error: error.message };
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    if (error instanceof BudgetExceededError)
      return {
        success: false,
        error:
          error.scope === "project"
            ? "This would exceed the project budget."
            : error.scope === "workspace_daily"
              ? "This would exceed the workspace daily budget."
              : "This would exceed the workspace monthly budget.",
      };
    return { success: false, error: "The thumbnail could not be regenerated." };
  }
}

export async function dismissThumbnailAction(
  formData: FormData,
): Promise<ThumbnailActionResult> {
  const parsed = dismissThumbnailSchema.safeParse({
    projectId: formData.get("projectId"),
    thumbnailGenerationId: formData.get("thumbnailGenerationId"),
  });
  if (!parsed.success)
    return { success: false, error: "The request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    await dismissThumbnailGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      thumbnailGenerationId: parsed.data.thumbnailGenerationId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The thumbnail could not be dismissed." };
  }
}

export async function cancelThumbnailGenerationAction(
  formData: FormData,
): Promise<ThumbnailActionResult> {
  const parsed = cancelThumbnailGenerationSchema.safeParse({
    projectId: formData.get("projectId"),
    thumbnailGenerationId: formData.get("thumbnailGenerationId"),
  });
  if (!parsed.success)
    return { success: false, error: "The cancel request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    const result = await cancelThumbnailGeneration({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      thumbnailGenerationId: parsed.data.thumbnailGenerationId,
    });
    if (result.cancelled)
      await recordAuditEvent({
        workspaceId: context.activeMembership.workspaceId,
        actorUserId: context.user.id,
        projectId: parsed.data.projectId,
        action: "generation_cancelled",
        targetType: "thumbnail_generation",
        targetId: parsed.data.thumbnailGenerationId,
      });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The generation could not be cancelled." };
  }
}

export async function toggleThumbnailFavoriteAction(
  formData: FormData,
): Promise<ThumbnailActionResult> {
  const parsed = toggleThumbnailFavoriteSchema.safeParse({
    projectId: formData.get("projectId"),
    thumbnailGenerationId: formData.get("thumbnailGenerationId"),
    isFavorite: formData.get("isFavorite"),
  });
  if (!parsed.success)
    return { success: false, error: "The request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    await setThumbnailFavorite({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      thumbnailGenerationId: parsed.data.thumbnailGenerationId,
      isFavorite: parsed.data.isFavorite === "true",
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The favorite could not be updated." };
  }
}

export async function loadThumbnailsViewAction(
  projectId: string,
): Promise<ThumbnailsView | null> {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const scope = {
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  };
  const [project, brief] = await Promise.all([
    findProject(scope),
    findProjectBrief(scope),
  ]);
  if (!project) return null;
  return loadThumbnailsView({
    workspaceId: scope.workspaceId,
    project,
    brief,
  });
}

export async function publishVideoAction(
  formData: FormData,
): Promise<PublishActionResult> {
  const parsed = publishVideoSchema.safeParse({
    projectId: formData.get("projectId"),
    renderId: formData.get("renderId"),
    connectionId: formData.get("connectionId"),
    platform: formData.get("platform"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    tags: formData.get("tags") ?? undefined,
    caption: formData.get("caption") ?? undefined,
    shareToFeed: formData.get("shareToFeed") ?? undefined,
    consentConfirmed: formData.get("consentConfirmed") ?? undefined,
    visibility: formData.get("visibility"),
    requestNonce: formData.get("requestNonce"),
  });
  if (!parsed.success)
    return { success: false, error: "The publish request is invalid." };
  try {
    const { context, project } = await requirePublishMutation(
      parsed.data.projectId,
    );
    const { publicationId } = await startVideoPublication({
      workspaceId: context.activeMembership.workspaceId,
      project,
      request: parsed.data,
      requestedByUserId: context.user.id,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      projectId: parsed.data.projectId,
      action: "video_published",
      targetType: "video_publication",
      targetId: publicationId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof VideoPublicationRequestError)
      return { success: false, error: error.message };
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    return { success: false, error: "The video could not be published." };
  }
}

export async function cancelPublicationAction(
  formData: FormData,
): Promise<PublishActionResult> {
  const parsed = cancelPublicationSchema.safeParse({
    projectId: formData.get("projectId"),
    publicationId: formData.get("publicationId"),
  });
  if (!parsed.success)
    return { success: false, error: "The cancel request is invalid." };
  try {
    const { context } = await requirePublishMutation(parsed.data.projectId);
    await cancelVideoPublication({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      publicationId: parsed.data.publicationId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The upload could not be cancelled." };
  }
}

export async function disconnectPlatformAction(
  formData: FormData,
): Promise<PublishActionResult> {
  const projectId = formData.get("projectId");
  const parsed = disconnectPlatformSchema.safeParse({
    connectionId: formData.get("connectionId"),
  });
  if (!parsed.success || typeof projectId !== "string")
    return { success: false, error: "The request is invalid." };
  try {
    const { context } = await requirePublishMutation(projectId);
    requireCapability(context.activeMembership.role, "manageSettings");
    const result = await disconnectPlatformAuthorization({
      connectionId: parsed.data.connectionId,
      workspaceId: context.activeMembership.workspaceId,
    });
    if (result.disconnected)
      await recordAuditEvent({
        workspaceId: context.activeMembership.workspaceId,
        actorUserId: context.user.id,
        action: "platform_disconnected",
        targetType: "platform_connection",
        targetId: parsed.data.connectionId,
      });
    revalidatePath(`/app/projects/${projectId}/publish`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The account could not be disconnected." };
  }
}

export async function loadPublishingViewAction(
  projectId: string,
): Promise<PublishingView | null> {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) return null;
  return loadPublishingView({
    workspaceId: context.activeMembership.workspaceId,
    project,
  });
}

export async function loadTitlesViewAction(
  projectId: string,
): Promise<TitlesView | null> {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) return null;
  const brief = await findProjectBrief({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  return loadTitlesView({
    workspaceId: context.activeMembership.workspaceId,
    project,
    brief,
  });
}
