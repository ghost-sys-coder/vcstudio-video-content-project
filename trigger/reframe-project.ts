import { logger, task, wait } from "@trigger.dev/sdk";
import {
  markReframeJobCompleted,
  markReframeJobFailed,
  markReframeJobRendering,
} from "@/db/commands/reframe-job-commands";
import { saveSceneVariantFraming } from "@/db/commands/output-variant-commands";
import { findProjectOutputVariant } from "@/db/repositories/output-variants.repository";
import { findProject } from "@/db/repositories/projects.repository";
import {
  findReframeJob,
  listReframeExtensionOutcomes,
} from "@/db/repositories/reframe-jobs.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import { startVideoRender } from "@/lib/render/start-video-render";

/** How long to keep waiting for the extensions before giving up on them. */
const MAX_EXTEND_WAIT_SECONDS = 2_400;
/** How long to keep watching the render. Matches the render task's own limit. */
const MAX_RENDER_WAIT_SECONDS = 3_600;
const POLL_SECONDS = 15;

/**
 * Carries a finished video into another shape without anybody watching it.
 *
 * **Why a task rather than a request.** Extending every still is a paid image
 * generation each, and the render that follows can run for many minutes. That
 * is far beyond a request, and `AGENTS.md` forbids long-running generation
 * inside one.
 *
 * **Why polling rather than waiting on child runs.** The extensions are
 * dispatched by the request that started the job, so this task has no child
 * runs to await. Polling the database also keeps PostgreSQL authoritative, as
 * `AGENTS.md` requires: this task holds no state of its own, so a lost run can
 * be replaced by another that reads exactly the same rows and reaches exactly
 * the same conclusion.
 *
 * **What it does when an extension fails.** It crops that scene instead and
 * records the scene number. A finished vertical video with two cropped scenes
 * is worth more than no video, provided the interface says which two. Failing
 * the whole job over one image would throw away every extension already paid
 * for.
 */
export const reframeProjectTask = task({
  id: "reframe-project",
  maxDuration: MAX_EXTEND_WAIT_SECONDS + MAX_RENDER_WAIT_SECONDS + 300,
  run: async (payload: {
    jobId: string;
    workspaceId: string;
    projectId: string;
  }) => {
    const scope = {
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
    };

    const job = await findReframeJob({
      workspaceId: payload.workspaceId,
      jobId: payload.jobId,
    });
    if (!job) return { outcome: "missing" as const };
    if (job.status !== "extending")
      return { outcome: "alreadyAdvanced" as const, status: job.status };

    const project = await findProject({
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
    });
    const outputVariant = await findProjectOutputVariant({
      ...scope,
      outputVariantId: job.outputVariantId,
    });
    if (!project || !outputVariant) {
      await markReframeJobFailed({
        workspaceId: payload.workspaceId,
        jobId: job.id,
        safeErrorMessage:
          "The project or output format is no longer available.",
      });
      return { outcome: "failed" as const };
    }

    // 1. Wait for every extension to reach a terminal state.
    const deadline = Date.now() + MAX_EXTEND_WAIT_SECONDS * 1000;
    let outcomes = await listReframeExtensionOutcomes({
      ...scope,
      generationIds: job.extendGenerationIds,
    });
    while (
      outcomes.some(
        (row) => !["succeeded", "failed", "cancelled"].includes(row.status),
      ) &&
      Date.now() < deadline
    ) {
      await wait.for({ seconds: POLL_SECONDS });
      outcomes = await listReframeExtensionOutcomes({
        ...scope,
        generationIds: job.extendGenerationIds,
      });
    }

    // 2. Point each extended scene at its new still. A scene whose extension
    //    did not land gets no framing row at all, which is what makes the
    //    renderer fall back to cropping the approved image.
    const cropped = new Set<number>(job.croppedSceneNumbers);
    let extended = 0;
    for (const row of outcomes) {
      if (row.status === "succeeded" && row.assetObjectKey) {
        await saveSceneVariantFraming({
          workspaceId: payload.workspaceId,
          projectId: payload.projectId,
          outputVariantId: job.outputVariantId,
          sceneId: row.sceneId,
          sceneVersionId: row.sceneVersionId,
          sourceImageGenerationId: row.generationId,
          mode: "outpaint",
          focalPointXBps: 5000,
          focalPointYBps: 5000,
          scaleBps: 10000,
          backgroundColor: "#000000",
          updatedByUserId: job.requestedByUserId,
        });
        extended += 1;
        continue;
      }
      logger.warn("Reframe extension did not land; cropping that scene", {
        jobId: job.id,
        generationId: row.generationId,
        status: row.status,
      });
    }

    // 3. Render the variant.
    let renderId: string;
    try {
      const render = await startVideoRender({
        workspaceId: payload.workspaceId,
        requestedByUserId: job.requestedByUserId,
        project,
        outputVariantId: job.outputVariantId,
        includeCaptions: true,
        includeWatermark: false,
        // The job's own id, so a replacement run resolves to the same
        // idempotency key rather than starting a second render.
        requestNonce: job.id,
      });
      renderId = render.renderId;
    } catch (error) {
      await markReframeJobFailed({
        workspaceId: payload.workspaceId,
        jobId: job.id,
        safeErrorMessage:
          error instanceof Error
            ? error.message
            : "The reframed render could not be started.",
      });
      return { outcome: "failed" as const };
    }

    const advanced = await markReframeJobRendering({
      workspaceId: payload.workspaceId,
      jobId: job.id,
      renderId,
      croppedSceneNumbers: [...cropped].sort((left, right) => left - right),
    });
    if (!advanced) return { outcome: "alreadyAdvanced" as const };

    // 4. Watch the render through to its end.
    const renderDeadline = Date.now() + MAX_RENDER_WAIT_SECONDS * 1000;
    let render = await findVideoRender({ ...scope, renderId });
    while (
      render &&
      !["succeeded", "failed", "cancelled"].includes(render.status) &&
      Date.now() < renderDeadline
    ) {
      await wait.for({ seconds: POLL_SECONDS });
      render = await findVideoRender({ ...scope, renderId });
    }

    if (render?.status === "succeeded") {
      await markReframeJobCompleted({
        workspaceId: payload.workspaceId,
        jobId: job.id,
      });
      return { outcome: "completed" as const, extended, renderId };
    }

    await markReframeJobFailed({
      workspaceId: payload.workspaceId,
      jobId: job.id,
      safeErrorMessage:
        render?.safeErrorMessage ??
        (render?.status === "cancelled"
          ? "The reframed render was cancelled."
          : "The reframed render did not finish in time."),
    });
    return { outcome: "failed" as const, renderId };
  },
});
