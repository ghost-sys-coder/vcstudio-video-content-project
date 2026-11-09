import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import { dirname } from "node:path";
import {
  completeMediaAssetInspection,
  completeRecordedAudioInspection,
  failMediaAssetInspection,
  failRecordedAudioInspection,
  saveMediaAssetThumbnail,
  attachMediaAssetInspectionRun,
} from "@/db/commands/media-inspection-commands";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { findSceneAudioGeneration } from "@/db/repositories/scene-audio.repository";
import {
  getMediaLibraryEnvironment,
  getSceneAudioEnvironment,
} from "@/lib/env/server";
import { inspectMediaFile } from "@/lib/media/inspect-media-file";
import { withMediaAssetFile } from "@/lib/storage/with-media-asset-file";
import { extractVideoThumbnail } from "@/lib/media/extract-video-thumbnail";
import { downloadSceneAudioBytes } from "@/lib/storage/scene-audio-storage";
import { storeVideoThumbnail } from "@/lib/media/store-video-thumbnail";
import { runMediaAssetThumbnail } from "@/lib/media/run-media-asset-thumbnail";

const payloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("video_thumbnail"),
    workspaceId: z.uuid(),
    mediaAssetId: z.uuid(),
  }),
  z.object({
    kind: z.literal("media_asset"),
    workspaceId: z.uuid(),
    mediaAssetId: z.uuid(),
  }),
  z.object({
    kind: z.literal("recorded_audio"),
    workspaceId: z.uuid(),
    projectId: z.uuid(),
    generationId: z.uuid(),
  }),
]);

function extension(contentType: string): string {
  const extensions: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
  };
  return extensions[contentType] ?? "bin";
}

export const mediaInspectionTask = task({
  id: "media-inspection",
  queue: { name: "media-processing", concurrencyLimit: 2 },
  retry: { maxAttempts: 2, minTimeoutInMs: 2_000, maxTimeoutInMs: 10_000 },
  maxDuration: 300,
  onFailure: async ({
    payload,
    ctx,
  }: {
    payload: z.infer<typeof payloadSchema>;
    ctx: { run: { id: string } };
  }) => {
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success || parsed.data.kind === "video_thumbnail") return;
    const message =
      "Verification stopped unexpectedly. Check the upload status and retry verification.";
    if (parsed.data.kind === "media_asset")
      await failMediaAssetInspection({
        ...parsed.data,
        message,
        expectedRunId: ctx.run.id,
      });
    else
      await failRecordedAudioInspection({
        ...parsed.data,
        message,
        expectedRunId: ctx.run.id,
      });
  },
  run: async (payload: z.infer<typeof payloadSchema>, { ctx }) => {
    const input = payloadSchema.parse(payload);
    const environment = getSceneAudioEnvironment();
    if (input.kind === "video_thumbnail") return runMediaAssetThumbnail(input);
    if (input.kind === "media_asset") {
      const asset = await findMediaAsset(input);
      if (!asset) throw new Error("MEDIA_ASSET_NOT_FOUND");
      if (asset.inspectionStatus === "succeeded")
        return { status: "succeeded" as const };
      if (asset.deletedAt || asset.status !== "pending")
        return { status: "failed" as const };
      if (
        !(await attachMediaAssetInspectionRun({
          ...input,
          triggerRunId: ctx.run.id,
        }))
      )
        return { status: "failed" as const };
      try {
        return await withMediaAssetFile(
          {
            objectKey: asset.objectKey,
            sizeBytes: asset.sizeBytes,
            maxBytes: getMediaLibraryEnvironment().MAX_MEDIA_VIDEO_BYTES,
            contentType: asset.contentType,
          },
          async (sourcePath) => {
            const result = await inspectMediaFile({
              sourcePath,
              expectedKind: "video",
              ffprobePath: environment.FFPROBE_PATH,
              ffmpegPath: environment.FFMPEG_PATH,
            });
            if (
              result.metadata.kind !== "video" ||
              result.metadata.durationMilliseconds >
                getMediaLibraryEnvironment().MAX_MEDIA_VIDEO_DURATION_SECONDS *
                  1000
            )
              throw new Error("VIDEO_DURATION_LIMIT_EXCEEDED");
            await completeMediaAssetInspection({
              ...input,
              metadata: result.metadata,
              warnings: result.warnings,
            });
            // Readiness is committed before optional thumbnail work begins.
            try {
              const thumbnail = await storeVideoThumbnail({
                ...input,
                thumbnail: await extractVideoThumbnail({
                  source: sourcePath,
                  directory: dirname(sourcePath),
                  ffmpegPath: environment.FFMPEG_PATH,
                  durationMilliseconds: result.metadata.durationMilliseconds,
                }),
              });
              await saveMediaAssetThumbnail({
                ...input,
                metadata: result.metadata,
                thumbnail,
              });
            } catch {
              console.warn(
                "Video is ready; optional preview thumbnail could not be created.",
              );
            }
            return { status: "succeeded" as const, warnings: result.warnings };
          },
        );
      } catch {
        await failMediaAssetInspection({
          ...input,
          expectedRunId: ctx.run.id,
          message:
            "The uploaded video is malformed or uses an unsupported container or codec.",
        });
        return { status: "failed" as const };
      }
    }

    const generation = await findSceneAudioGeneration(input);
    if (!generation?.assetObjectKey)
      throw new Error("RECORDED_AUDIO_NOT_FOUND");
    if (generation.inspectionStatus === "succeeded")
      return { status: "succeeded" as const };
    try {
      const result = await inspectMediaFile({
        bytes: await downloadSceneAudioBytes(generation.assetObjectKey),
        extension: extension(generation.assetContentType ?? ""),
        expectedKind: "audio",
        ffprobePath: environment.FFPROBE_PATH,
        ffmpegPath: environment.FFMPEG_PATH,
      });
      if (result.metadata.kind !== "audio" || !result.amplitudeEnvelope)
        throw new Error("RECORDED_AUDIO_INSPECTION_INCOMPLETE");
      await completeRecordedAudioInspection({
        ...input,
        metadata: result.metadata,
        warnings: result.warnings,
        amplitudeEnvelope: result.amplitudeEnvelope,
      });
      return { status: "succeeded" as const, warnings: result.warnings };
    } catch {
      await failRecordedAudioInspection({
        ...input,
        message:
          "The recording could not be decoded. Record it again in this browser.",
      });
      return { status: "failed" as const };
    }
  },
});
