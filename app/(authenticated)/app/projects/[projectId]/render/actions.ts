"use server";

import { revalidatePath } from "next/cache";
import { findProject } from "@/db/repositories/projects.repository";
import { findProjectOutputVariant } from "@/db/repositories/output-variants.repository";
import { findSceneImageGeneration } from "@/db/repositories/scene-images.repository";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import { listApprovedSceneImageAssets } from "@/db/repositories/subtitle.repository";
import { saveSceneVariantFraming } from "@/db/commands/output-variant-commands";
import { createShortComposition } from "@/db/commands/short-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  BudgetExceededError,
  RateLimitExceededError,
} from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { cancelVideoRenderRun } from "@/lib/render/cancel-video-render";
import {
  startVideoRender,
  VideoRenderRequestError,
  VideoRenderTimelineInvalidError,
} from "@/lib/render/start-video-render";
import type { RenderActionResult } from "@/lib/render/render-view";
import { cancelRenderSchema, startRenderSchema } from "@/lib/schemas/render";
import {
  saveSceneVariantFramingSchema,
  startSceneOutpaintSchema,
} from "@/lib/schemas/output-variant";
import { startSceneOutpaint } from "@/lib/output-variants/start-scene-outpaint";
import { createShortCompositionSchema } from "@/lib/schemas/short";
import { buildOutputVariantTimelineContext } from "@/lib/output-variants/output-variant-context";
import { buildShortTimeline } from "@/lib/shorts/short-timeline";

async function requireRenderAccess(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  requireCapability(context.activeMembership.role, "renderVideo");
  if (project.status === "archived") throw new Error("PROJECT_ARCHIVED");
  return { context, project };
}

export async function startRenderAction(
  formData: FormData,
): Promise<RenderActionResult> {
  const parsed = startRenderSchema.safeParse({
    projectId: formData.get("projectId"),
    outputVariantId: formData.get("outputVariantId"),
    shortCompositionId: formData.get("shortCompositionId") || undefined,
    presetId: formData.get("presetId"),
    includeCaptions: formData.get("includeCaptions"),
    includeWatermark: formData.get("includeWatermark"),
    requestNonce: formData.get("requestNonce"),
  });
  if (!parsed.success)
    return { success: false, error: "The render request is invalid." };

  try {
    const { context, project } = await requireRenderAccess(
      parsed.data.projectId,
    );
    const result = await startVideoRender({
      workspaceId: context.activeMembership.workspaceId,
      requestedByUserId: context.user.id,
      project,
      outputVariantId: parsed.data.outputVariantId,
      shortCompositionId: parsed.data.shortCompositionId,
      presetId: parsed.data.presetId,
      includeCaptions: parsed.data.includeCaptions,
      includeWatermark: parsed.data.includeWatermark,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/render`);
    return { success: true, error: null, renderId: result.renderId };
  } catch (error) {
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    if (error instanceof VideoRenderTimelineInvalidError)
      return {
        success: false,
        error: "The timeline is not ready to render.",
        issues: error.issues,
      };
    if (error instanceof VideoRenderRequestError)
      return { success: false, error: error.message };
    if (error instanceof BudgetExceededError)
      return {
        success: false,
        error: "This render would exceed the available budget.",
      };
    return { success: false, error: "The render could not be started." };
  }
}

export async function cancelRenderAction(
  formData: FormData,
): Promise<RenderActionResult> {
  const parsed = cancelRenderSchema.safeParse({
    projectId: formData.get("projectId"),
    renderId: formData.get("renderId"),
  });
  if (!parsed.success)
    return { success: false, error: "The cancel request is invalid." };

  try {
    const { context } = await requireRenderAccess(parsed.data.projectId);
    const result = await cancelVideoRenderRun({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      renderId: parsed.data.renderId,
      actorUserId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/render`);
    if (!result.cancelled)
      return {
        success: false,
        error: "This render can no longer be cancelled.",
      };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The render could not be cancelled." };
  }
}

export async function saveSceneFramingAction(
  formData: FormData,
): Promise<RenderActionResult> {
  const parsed = saveSceneVariantFramingSchema.safeParse({
    projectId: formData.get("projectId"),
    outputVariantId: formData.get("outputVariantId"),
    sceneId: formData.get("sceneId"),
    sceneVersionId: formData.get("sceneVersionId"),
    sourceImageGenerationId: formData.get("sourceImageGenerationId"),
    mode: formData.get("mode"),
    focalPointXBps: formData.get("focalPointXBps"),
    focalPointYBps: formData.get("focalPointYBps"),
    scaleBps: formData.get("scaleBps"),
    backgroundColor: formData.get("backgroundColor"),
  });
  if (!parsed.success)
    return { success: false, error: "The framing settings are invalid." };

  try {
    const { context, project } = await requireRenderAccess(
      parsed.data.projectId,
    );
    const scope = {
      workspaceId: context.activeMembership.workspaceId,
      projectId: project.id,
    };
    const [variant, currentScenes] = await Promise.all([
      findProjectOutputVariant({
        ...scope,
        outputVariantId: parsed.data.outputVariantId,
      }),
      listCurrentScenes(scope),
    ]);
    const current = currentScenes.find(
      ({ scene, version }) =>
        scene.id === parsed.data.sceneId &&
        version.id === parsed.data.sceneVersionId,
    );
    if (!variant || !current)
      return { success: false, error: "The scene output was not found." };
    const [approvedImage] = await listApprovedSceneImageAssets({
      ...scope,
      sceneVersionIds: [parsed.data.sceneVersionId],
    });
    if (
      !approvedImage ||
      approvedImage.generationId !== parsed.data.sourceImageGenerationId
    )
      return {
        success: false,
        error: "The approved scene image has changed. Refresh and try again.",
      };

    await saveSceneVariantFraming({
      ...scope,
      ...parsed.data,
      updatedByUserId: context.user.id,
    });
    revalidatePath(`/app/projects/${project.id}/render`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The scene framing could not be saved." };
  }
}

export async function startSceneOutpaintAction(formData: FormData) {
  const parsed = startSceneOutpaintSchema.safeParse({
    projectId: formData.get("projectId"),
    outputVariantId: formData.get("outputVariantId"),
    sceneId: formData.get("sceneId"),
    sceneVersionId: formData.get("sceneVersionId"),
    sourceImageGenerationId: formData.get("sourceImageGenerationId"),
    requestNonce: formData.get("requestNonce"),
  });
  if (!parsed.success)
    return {
      success: false as const,
      error: "The outpaint request is invalid.",
    };
  try {
    const { context, project } = await requireRenderAccess(
      parsed.data.projectId,
    );
    const scope = {
      workspaceId: context.activeMembership.workspaceId,
      projectId: project.id,
    };
    const [variant, source] = await Promise.all([
      findProjectOutputVariant({
        ...scope,
        outputVariantId: parsed.data.outputVariantId,
      }),
      findSceneImageGeneration({
        ...scope,
        generationId: parsed.data.sourceImageGenerationId,
      }),
    ]);
    if (
      !variant ||
      !source ||
      source.sceneId !== parsed.data.sceneId ||
      source.sceneVersionId !== parsed.data.sceneVersionId ||
      source.status !== "succeeded" ||
      source.reviewStatus !== "approved" ||
      source.purpose !== "scene"
    )
      return {
        success: false as const,
        error: "The approved source image is unavailable.",
      };
    if (variant.aspectRatio === project.aspectRatio)
      return {
        success: false as const,
        error: "The original output does not need outpainting.",
      };
    const result = await startSceneOutpaint({
      workspaceId: scope.workspaceId,
      requestedByUserId: context.user.id,
      project,
      outputVariant: variant,
      sourceGeneration: source,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/projects/${project.id}/render`);
    return { success: true as const, error: null, ...result };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error && error.message.includes("budget")
          ? "This outpaint would exceed the available budget."
          : "The outpaint could not be started.",
    };
  }
}

export async function createShortCompositionAction(formData: FormData) {
  let clips: unknown = null;
  try {
    clips = JSON.parse(String(formData.get("clips") ?? "null")) as unknown;
  } catch {
    return {
      success: false as const,
      error: "The selected clips are invalid.",
    };
  }
  const parsed = createShortCompositionSchema.safeParse({
    projectId: formData.get("projectId"),
    outputVariantId: formData.get("outputVariantId"),
    name: formData.get("name"),
    clips,
  });
  if (!parsed.success)
    return { success: false as const, error: "The short draft is invalid." };

  try {
    const { context, project } = await requireRenderAccess(
      parsed.data.projectId,
    );
    const scope = {
      workspaceId: context.activeMembership.workspaceId,
      projectId: project.id,
    };
    const variant = await findProjectOutputVariant({
      ...scope,
      outputVariantId: parsed.data.outputVariantId,
    });
    if (!variant || variant.aspectRatio !== "9:16")
      return {
        success: false as const,
        error: "Shorts require the vertical 9:16 output.",
      };
    const timelineContext = await buildOutputVariantTimelineContext({
      workspaceId: scope.workspaceId,
      project,
      outputVariant: variant,
    });
    if (timelineContext.timeline.status !== "ready")
      return {
        success: false as const,
        error: "The source timeline is not ready.",
      };
    const clipDefinitions = parsed.data.clips.map((clip) => ({
      ...clip,
      id: crypto.randomUUID(),
    }));
    const built = buildShortTimeline({
      source: timelineContext.timeline.timeline,
      clips: clipDefinitions,
      width: variant.width,
      height: variant.height,
    });
    const created = await createShortComposition({
      ...scope,
      outputVariantId: variant.id,
      name: parsed.data.name,
      createdByUserId: context.user.id,
      clips: clipDefinitions,
    });
    revalidatePath(`/app/projects/${project.id}/render`);
    return {
      success: true as const,
      error: null,
      shortCompositionId: created.id,
      warnings: built.warnings.map((warning) => warning.message),
    };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof RangeError
          ? error.message
          : "The short draft could not be created.",
    };
  }
}
