import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  claimVideoRenderRunning,
  completeVideoRender,
  failVideoRender,
  updateVideoRenderProgress,
} from "@/db/commands/video-render-commands";
import { findVideoRenderWorkflowContext } from "@/db/repositories/video-render.repository";
import { getRenderEnvironment } from "@/lib/env/server";
import { VIDEO_COMPOSITION_ID } from "@/lib/render/composition-id";
import {
  buildVideoCompositionInput,
  parseVideoCompositionInput,
} from "@/lib/render/render-composition-input";
import { estimateRenderCostCents } from "@/lib/render/render-cost";
import { RemotionVideoRenderProvider } from "@/lib/render/remotion-video-render-provider";
import { createVideoExportObjectKey } from "@/lib/storage/object-key";
import {
  createRenderAssetDownloadUrls,
  findStoredVideoExport,
  putVideoExportFromFile,
} from "@/lib/storage/video-export-storage";

export const videoRenderTaskPayloadSchema = z.object({
  renderId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

type VideoRenderTaskPayload = z.infer<typeof videoRenderTaskPayloadSchema>;

export const videoRenderTask = task({
  id: "video-render",
  queue: { name: "video-rendering", concurrencyLimit: 1 },
  // Remotion drives a headless Chromium and bundles the composition in-process,
  // which is memory-heavy; the default machine OOM-kills even a short render.
  machine: "large-1x",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 60_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 3_600,
  run: async (payload: VideoRenderTaskPayload) => {
    const input = videoRenderTaskPayloadSchema.parse(payload);
    const environment = getRenderEnvironment();
    const scope = {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      renderId: input.renderId,
    };

    const context = await findVideoRenderWorkflowContext(scope);
    if (!context) throw new Error("VIDEO_RENDER_NOT_FOUND");
    const { render, reservation } = context;

    if (render.status === "succeeded")
      return { renderId: render.id, status: "succeeded" as const };
    if (render.status === "failed" || render.status === "cancelled")
      return { renderId: render.id, status: render.status };

    if (!environment.ENABLE_VIDEO_RENDERING) {
      await failVideoRender({
        ...scope,
        category: "rendering_disabled",
        safeErrorMessage: "Video rendering is currently disabled.",
      });
      return { renderId: render.id, status: "failed" as const };
    }
    if (!reservation || reservation.status !== "pending") {
      await failVideoRender({
        ...scope,
        category: "reservation_not_pending",
        safeErrorMessage:
          "The render reservation was not available. Start a new render to try again.",
      });
      return { renderId: render.id, status: "failed" as const };
    }

    const objectKey = createVideoExportObjectKey(scope);
    const actualCostCents = estimateRenderCostCents({
      durationMilliseconds: render.durationMilliseconds,
      rates: {
        costPerMinuteCents: environment.VIDEO_RENDER_COST_PER_MINUTE_CENTS,
        minimumEstimateCents: environment.VIDEO_RENDER_MINIMUM_ESTIMATE_CENTS,
      },
    });

    // Recover an already-uploaded export from a previous crashed attempt.
    const alreadyStored = await findStoredVideoExport({
      objectKey,
      renderId: render.id,
    });
    if (alreadyStored) {
      await completeVideoRender({
        ...scope,
        providerRequestId: render.providerRequestId,
        actualCostCents,
        outputDurationMilliseconds: render.durationMilliseconds,
        asset: {
          objectKey: alreadyStored.objectKey,
          contentType: alreadyStored.contentType,
          sizeBytes: alreadyStored.sizeBytes,
          etag: alreadyStored.etag,
        },
      });
      return { renderId: render.id, status: "succeeded" as const };
    }

    const maximumAttempts = environment.MAX_RENDER_ATTEMPTS + 1;
    const attemptNumber = render.attemptCount + 1;
    if (attemptNumber > maximumAttempts) {
      await failVideoRender({
        ...scope,
        category: "render_retry_limit_reached",
        safeErrorMessage:
          "The render retry limit was reached. Start a new render to try again.",
      });
      return { renderId: render.id, status: "failed" as const };
    }

    const providerRequestId = randomUUID();
    const claim = await claimVideoRenderRunning({
      ...scope,
      attemptNumber,
      providerRequestId,
    });
    if (!claim.claimed && claim.render.status === "succeeded")
      return { renderId: render.id, status: "succeeded" as const };

    // Resolve every scene asset to a short-lived signed URL, then validate the
    // fully-resolved composition props before any pixels are rendered.
    const objectKeys = render.timelineSnapshot.scenes.flatMap((scene) => [
      scene.image.objectKey,
      scene.audio.objectKey,
    ]);
    const assetUrls = await createRenderAssetDownloadUrls(objectKeys);
    const compositionInput = parseVideoCompositionInput(
      buildVideoCompositionInput({
        snapshot: render.timelineSnapshot,
        imageUrlByObjectKey: assetUrls,
        audioUrlByObjectKey: assetUrls,
        watermarkText: render.timelineSnapshot.includeWatermark
          ? environment.VIDEO_WATERMARK_TEXT
          : "",
      }),
    );

    const outputFilePath = path.join(
      tmpdir(),
      `render-${render.id}-${randomUUID()}.mp4`,
    );
    const provider = new RemotionVideoRenderProvider();
    let lastReportedPercent = 15;

    try {
      await provider.render({
        entryPointPath: path.resolve(process.cwd(), "remotion", "index.ts"),
        aliasRoot: process.cwd(),
        compositionId: VIDEO_COMPOSITION_ID,
        input: compositionInput,
        outputFilePath,
        crf: environment.VIDEO_RENDER_CRF,
        jpegQuality: environment.VIDEO_RENDER_JPEG_QUALITY,
        concurrency: environment.VIDEO_RENDER_CONCURRENCY,
        timeoutMilliseconds: environment.VIDEO_RENDER_TIMEOUT_SECONDS * 1_000,
        chromiumExecutable: environment.REMOTION_CHROMIUM_EXECUTABLE,
        onProgress: (percent) => {
          const mapped = 15 + Math.round(percent * 0.8);
          if (mapped >= lastReportedPercent + 5) {
            lastReportedPercent = mapped;
            void updateVideoRenderProgress({
              ...scope,
              progressPercent: mapped,
            }).catch(() => {});
          }
        },
      });
    } catch (error) {
      // Log the underlying provider error before any follow-up work so it is
      // never masked if the failure-recording write itself throws.
      console.error("Video render failed.", {
        renderId: render.id,
        error: error instanceof Error ? (error.stack ?? error.message) : error,
      });
      await rm(outputFilePath, { force: true });
      await failVideoRender({
        ...scope,
        category: "render_failed",
        safeErrorMessage:
          "The video could not be rendered. Start a new render to try again.",
        providerRequestId,
      });
      return { renderId: render.id, status: "failed" as const };
    }

    try {
      const stored = await putVideoExportFromFile({
        objectKey,
        filePath: outputFilePath,
        renderId: render.id,
      });
      await completeVideoRender({
        ...scope,
        providerRequestId,
        actualCostCents,
        outputDurationMilliseconds: render.durationMilliseconds,
        asset: {
          objectKey: stored.objectKey,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          etag: stored.etag,
        },
      });
      return { renderId: render.id, status: "succeeded" as const };
    } catch (error) {
      await failVideoRender({
        ...scope,
        category: "export_upload_failed",
        safeErrorMessage:
          "The rendered video could not be saved. Start a new render to try again.",
        providerRequestId,
      });
      console.error("Video export upload failed.", {
        renderId: render.id,
        error,
      });
      return { renderId: render.id, status: "failed" as const };
    } finally {
      await rm(outputFilePath, { force: true });
    }
  },
});
