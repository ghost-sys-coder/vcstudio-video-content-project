import "server-only";

import type { Project } from "@/db/schema";
import { listProjectOutputVariants } from "@/db/repositories/output-variants.repository";
import {
  findLatestReframeJob,
  listReframeExtensionOutcomes,
} from "@/db/repositories/reframe-jobs.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import {
  describeReframeProgress,
  type ReframeProgress,
} from "@/lib/reframe/reframe-progress";

export interface ReframeTargetView {
  outputVariantId: string;
  name: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  width: number;
  height: number;
  job: {
    id: string;
    status: "extending" | "rendering" | "completed" | "failed" | "cancelled";
    statusLabel: string;
    sceneCount: number;
    extendCount: number;
    readyCount: number;
    croppedSceneNumbers: number[];
    estimatedCostCents: number;
    renderId: string | null;
    safeErrorMessage: string | null;
    /** Measured, never estimated. See `describeReframeProgress`. */
    progress: ReframeProgress;
    /** Still doing something, so the panel offers cancelling rather than starting. */
    active: boolean;
  } | null;
}

const STATUS_LABELS = {
  extending: "Extending images",
  rendering: "Rendering",
  completed: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

/**
 * The shapes this project can be reframed into, with the last attempt at each.
 *
 * The project's own shape is excluded: it is the video that already exists, and
 * offering to reframe it into itself would be a button that does nothing.
 */
export async function loadReframeTargets(input: {
  workspaceId: string;
  project: Project;
}): Promise<ReframeTargetView[]> {
  const variants = await listProjectOutputVariants({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });

  return Promise.all(
    variants
      .filter((variant) => variant.aspectRatio !== input.project.aspectRatio)
      .map(async (variant): Promise<ReframeTargetView> => {
        const job = await findLatestReframeJob({
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          outputVariantId: variant.id,
        });

        // Counted from the generation rows rather than from anything the job
        // wrote down, so progress reflects what actually happened even if the
        // run that started it has gone.
        const outcomes = job
          ? await listReframeExtensionOutcomes({
              workspaceId: input.workspaceId,
              projectId: input.project.id,
              generationIds: job.extendGenerationIds,
            })
          : [];
        const render =
          job?.renderId !== null && job?.renderId !== undefined
            ? await findVideoRender({
                workspaceId: input.workspaceId,
                projectId: input.project.id,
                renderId: job.renderId,
              })
            : null;

        return {
          outputVariantId: variant.id,
          name: variant.name,
          aspectRatio: variant.aspectRatio,
          width: variant.width,
          height: variant.height,
          job: job
            ? {
                id: job.id,
                status: job.status,
                statusLabel: STATUS_LABELS[job.status],
                sceneCount: job.sceneCount,
                extendCount: job.extendCount,
                readyCount: job.readyCount,
                croppedSceneNumbers: job.croppedSceneNumbers,
                estimatedCostCents: job.estimatedCostCents,
                renderId: job.renderId,
                safeErrorMessage: job.safeErrorMessage,
                progress: describeReframeProgress({
                  status: job.status,
                  totalExtensions: job.extendGenerationIds.length,
                  succeededExtensions: outcomes.filter(
                    (row) => row.status === "succeeded",
                  ).length,
                  failedExtensions: outcomes.filter(
                    (row) =>
                      row.status === "failed" || row.status === "cancelled",
                  ).length,
                  renderPercent: render?.progressPercent ?? null,
                }),
                active:
                  job.status === "extending" || job.status === "rendering",
              }
            : null,
        };
      }),
  );
}
