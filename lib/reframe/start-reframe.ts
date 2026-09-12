import "server-only";

import { randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { SCENE_OUTPAINT_PROMPT_VERSION } from "@studio/prompts";
import type { Project, ProjectOutputVariant } from "@/db/schema";
import {
  attachReframeJobRun,
  createReframeJob,
} from "@/db/commands/reframe-job-commands";
import { listSceneVariantOutpaints } from "@/db/repositories/output-variants.repository";
import {
  findActiveReframeJob,
  listApprovedSceneImageOrigins,
} from "@/db/repositories/reframe-jobs.repository";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import { listApprovedSceneImageAssets } from "@/db/repositories/subtitle.repository";
import {
  estimateSceneOutpaintCost,
  startSceneOutpaint,
} from "@/lib/output-variants/start-scene-outpaint";
import { buildSceneOutpaintPrompt } from "@/lib/output-variants/scene-outpaint-prompt";
import { planReframe, type ReframePlan } from "@/lib/reframe/reframe-plan";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
import { findSceneImageGeneration } from "@/db/repositories/scene-images.repository";
import type { reframeProjectTask } from "@/trigger/reframe-project";

export class ReframeNotPossibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReframeNotPossibleError";
  }
}

/**
 * Plans a reframe without starting one.
 *
 * Split from the start so the button can show what it is about to spend, and
 * so a creator can see which scenes will be cropped rather than extended
 * before agreeing to any of it.
 */
export async function planProjectReframe(input: {
  workspaceId: string;
  project: Project;
  outputVariant: ProjectOutputVariant;
}): Promise<{ plan: ReframePlan; estimatedCostCents: number }> {
  if (input.outputVariant.aspectRatio === input.project.aspectRatio)
    throw new ReframeNotPossibleError(
      "This is the shape the project was made in, so there is nothing to reframe.",
    );

  const scope = {
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  };
  const currentScenes = await listCurrentScenes(scope);
  const sceneVersionIds = currentScenes.map(({ version }) => version.id);

  const canonicalSize = getSceneImageSizeForAspectRatio(
    input.project.aspectRatio,
  );
  const nativeSize = getSceneImageSizeForAspectRatio(
    input.outputVariant.aspectRatio,
  );

  const [origins, nativeImages, existingOutpaints] = await Promise.all([
    listApprovedSceneImageOrigins({
      ...scope,
      sceneVersionIds,
      size: canonicalSize,
    }),
    listApprovedSceneImageAssets({
      ...scope,
      sceneVersionIds,
      size: nativeSize,
    }),
    listSceneVariantOutpaints({
      ...scope,
      outputVariantId: input.outputVariant.id,
    }),
  ]);

  // First row wins, and the queries order by shot, so this is the still that
  // represents the scene rather than an arbitrary one.
  const originByVersion = new Map<
    string,
    { generationId: string; source: string }
  >();
  for (const row of origins)
    if (!originByVersion.has(row.sceneVersionId))
      originByVersion.set(row.sceneVersionId, {
        generationId: row.generationId,
        source: row.source,
      });

  const nativeVersions = new Set(
    nativeImages.map((image) => image.sceneVersionId),
  );

  const outpaintByVersion = new Map<
    string,
    {
      generationId: string;
      sourceImageGenerationId: string;
      status: string;
      promptTemplateVersion: string | null;
    }
  >();
  // Newest first from the query, so the first seen is the latest attempt.
  for (const row of existingOutpaints)
    if (
      !outpaintByVersion.has(row.sceneVersionId) &&
      row.sourceImageGenerationId
    )
      outpaintByVersion.set(row.sceneVersionId, {
        generationId: row.id,
        sourceImageGenerationId: row.sourceImageGenerationId,
        status: row.status,
        promptTemplateVersion: row.promptTemplateVersion,
      });

  const plan = planReframe(
    currentScenes.map(({ scene, version }) => {
      const origin = originByVersion.get(version.id) ?? null;
      const existing = outpaintByVersion.get(version.id) ?? null;
      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: version.id,
        approvedImage: origin
          ? {
              generationId: origin.generationId,
              source:
                origin.source === "ai_generated"
                  ? ("ai_generated" as const)
                  : ("user_uploaded" as const),
            }
          : null,
        hasNativeImage: nativeVersions.has(version.id),
        existingVariantImage: existing
          ? {
              generationId: existing.generationId,
              sourceImageGenerationId: existing.sourceImageGenerationId,
              status: existing.status as
                "succeeded" | "running" | "queued" | "pending" | "failed",
              matchesCurrentPrompt:
                existing.promptTemplateVersion ===
                SCENE_OUTPAINT_PROMPT_VERSION,
            }
          : null,
      };
    }),
  );

  // One prompt serves every scene: the outpaint instruction depends on the
  // target canvas, not on the picture, so the estimate is the same each time.
  const perSceneCents = estimateSceneOutpaintCost({
    prompt: buildSceneOutpaintPrompt(input.outputVariant),
    aspectRatio: input.outputVariant.aspectRatio,
  });

  return { plan, estimatedCostCents: perSceneCents * plan.extendCount };
}

/**
 * Starts the reframe: extends what can be extended, then leaves the rest to
 * the orchestrating task.
 *
 * Dispatching happens here rather than inside the task so a budget refusal or
 * a missing approval is reported to the person who clicked, while they are
 * present to act on it, rather than surfacing minutes later as a failed run.
 */
export async function startProjectReframe(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  outputVariant: ProjectOutputVariant;
}) {
  const existing = await findActiveReframeJob({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    outputVariantId: input.outputVariant.id,
  });
  if (existing)
    throw new ReframeNotPossibleError(
      "A reframe into this shape is already running.",
    );

  const { plan, estimatedCostCents } = await planProjectReframe(input);

  if (plan.scenes.length === 0)
    throw new ReframeNotPossibleError("This project has no scenes yet.");
  if (plan.blockedCount > 0) {
    const blocked = plan.scenes
      .filter((scene) => scene.action === "blocked")
      .map((scene) => scene.sceneNumber);
    throw new ReframeNotPossibleError(
      `Approve an image for ${blocked.length === 1 ? "scene" : "scenes"} ${blocked.join(", ")} before reframing.`,
    );
  }

  // Dispatched one at a time rather than as a batch because each needs its own
  // reservation and budget check, and a refusal partway through must leave the
  // earlier ones standing rather than rolling back paid work.
  const extendGenerationIds: string[] = [];
  for (const scene of plan.scenes) {
    if (scene.action !== "extend" || !scene.sourceGenerationId) continue;
    const source = await findSceneImageGeneration({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      generationId: scene.sourceGenerationId,
    });
    if (!source) continue;
    const started = await startSceneOutpaint({
      workspaceId: input.workspaceId,
      requestedByUserId: input.requestedByUserId,
      project: input.project,
      outputVariant: input.outputVariant,
      sourceGeneration: source,
      requestNonce: randomUUID(),
    });
    extendGenerationIds.push(started.generationId);
  }

  const job = await createReframeJob({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    outputVariantId: input.outputVariant.id,
    requestedByUserId: input.requestedByUserId,
    status: "extending",
    sceneCount: plan.scenes.length,
    extendCount: extendGenerationIds.length,
    cropCount: plan.cropCount,
    readyCount: plan.readyCount,
    estimatedCostCents,
    extendGenerationIds,
    croppedSceneNumbers: plan.scenes
      .filter((scene) => scene.action === "crop")
      .map((scene) => scene.sceneNumber),
  });

  const handle = await tasks.trigger<typeof reframeProjectTask>(
    "reframe-project",
    {
      jobId: job.id,
      workspaceId: input.workspaceId,
      projectId: input.project.id,
    },
    { idempotencyKey: `reframe-${job.id}` },
  );
  await attachReframeJobRun({
    workspaceId: input.workspaceId,
    jobId: job.id,
    triggerRunId: handle.id,
  });

  return { job, plan, estimatedCostCents };
}
