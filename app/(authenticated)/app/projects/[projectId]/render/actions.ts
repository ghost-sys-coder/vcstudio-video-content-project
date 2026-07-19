"use server";

import { revalidatePath } from "next/cache";
import { cancelVideoRender } from "@/db/commands/video-render-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  BudgetExceededError,
  RateLimitExceededError,
} from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  startVideoRender,
  VideoRenderRequestError,
  VideoRenderTimelineInvalidError,
} from "@/lib/render/start-video-render";
import type { RenderActionResult } from "@/lib/render/render-view";
import { cancelRenderSchema, startRenderSchema } from "@/lib/schemas/render";

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
    const result = await cancelVideoRender({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      renderId: parsed.data.renderId,
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
