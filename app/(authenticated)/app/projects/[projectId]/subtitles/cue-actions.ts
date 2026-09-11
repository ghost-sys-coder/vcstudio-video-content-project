"use server";

import { revalidatePath } from "next/cache";
import { findProject } from "@/db/repositories/projects.repository";
import { findApprovedSceneAudioForVersion } from "@/db/repositories/subtitle.repository";
import {
  clearSceneCaptionCues,
  saveSceneCaptionCues,
  CaptionCueConflictError,
} from "@/db/commands/scene-caption-cue-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getSubtitleEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { findCueProblem } from "@/lib/subtitles/cue-editing";
import {
  clearCaptionCuesSchema,
  saveCaptionCuesSchema,
} from "@/lib/schemas/caption-cues";

export type CaptionCueActionResult =
  | { status: "saved"; revision: number }
  | { status: "cleared" }
  | { status: "error"; message: string };

async function authorize(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  requireCapability(context.activeMembership.role, "manageSubtitles");
  const workspaceId = context.activeMembership.workspaceId;
  const project = await findProject({ workspaceId, projectId });
  if (!project || project.status === "archived") return null;
  return { workspaceId, projectId, userId: context.user.id };
}

/**
 * Saves a corrected cue list for one scene's narration.
 *
 * **The narration is resolved on the server, not taken from the request.** The
 * browser sends which audio it believes it was editing, and that id is checked
 * against the approved narration for that scene version. If the audio has been
 * replaced since the page loaded, the correction describes a recording that is
 * no longer in use and is refused rather than attached to the new one — which
 * would silently apply times measured against different speech.
 *
 * The invariants are then re-checked against the real clip length, because the
 * duration the browser used is as untrusted as everything else it sent.
 */
export async function saveCaptionCuesAction(
  value: unknown,
): Promise<CaptionCueActionResult> {
  const parsed = saveCaptionCuesSchema.safeParse(value);
  if (!parsed.success)
    return { status: "error", message: "Those caption times were not valid." };
  const input = parsed.data;
  try {
    const authorized = await authorize(input.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };

    const audio = await findApprovedSceneAudioForVersion({
      workspaceId: authorized.workspaceId,
      projectId: authorized.projectId,
      sceneVersionId: input.sceneVersionId,
    });
    if (!audio)
      return {
        status: "error",
        message:
          "This scene has no approved narration to time captions against.",
      };
    if (audio.generationId !== input.audioGenerationId)
      return {
        status: "error",
        message:
          "The narration for this scene was replaced while you were editing. Reload to time the captions against the new recording.",
      };
    const sceneDurationMilliseconds = audio.durationMilliseconds ?? 0;
    if (sceneDurationMilliseconds <= 0)
      return {
        status: "error",
        message: "This narration has no measured length yet.",
      };

    const problem = findCueProblem(input.cues, {
      sceneDurationMilliseconds,
      minimumCueDurationMilliseconds:
        getSubtitleEnvironment().SUBTITLE_MIN_SEGMENT_DURATION_MILLISECONDS,
    });
    if (problem) return { status: "error", message: problem };

    const saved = await saveSceneCaptionCues({
      workspaceId: authorized.workspaceId,
      projectId: authorized.projectId,
      sceneVersionId: input.sceneVersionId,
      audioGenerationId: input.audioGenerationId,
      cues: input.cues,
      expectedRevision: input.expectedRevision,
      userId: authorized.userId,
    });
    revalidatePath(`/app/projects/${input.projectId}/subtitles`);
    return { status: "saved", revision: saved.revision };
  } catch (error) {
    if (error instanceof CaptionCueConflictError)
      return {
        status: "error",
        message:
          "These captions were changed somewhere else. Reload before editing them again.",
      };
    return {
      status: "error",
      message: "The caption times could not be saved.",
    };
  }
}

/** Discards corrections so the scene returns to derived timing. */
export async function clearCaptionCuesAction(
  value: unknown,
): Promise<CaptionCueActionResult> {
  const parsed = clearCaptionCuesSchema.safeParse(value);
  if (!parsed.success)
    return { status: "error", message: "That request was not valid." };
  try {
    const authorized = await authorize(parsed.data.projectId);
    if (!authorized)
      return { status: "error", message: "This project is unavailable." };
    await clearSceneCaptionCues({
      workspaceId: authorized.workspaceId,
      projectId: authorized.projectId,
      sceneVersionId: parsed.data.sceneVersionId,
      audioGenerationId: parsed.data.audioGenerationId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/subtitles`);
    return { status: "cleared" };
  } catch {
    return {
      status: "error",
      message: "The corrections could not be removed.",
    };
  }
}
