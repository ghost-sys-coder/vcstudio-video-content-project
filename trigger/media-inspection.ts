import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  completeMediaAssetInspection,
  completeRecordedAudioInspection,
  failMediaAssetInspection,
  failRecordedAudioInspection,
} from "@/db/commands/media-inspection-commands";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { findSceneAudioGeneration } from "@/db/repositories/scene-audio.repository";
import {
  getMediaLibraryEnvironment,
  getSceneAudioEnvironment,
} from "@/lib/env/server";
import { inspectMediaFile } from "@/lib/media/inspect-media-file";
import { downloadMediaAssetBytes } from "@/lib/storage/media-asset-storage";
import { downloadSceneAudioBytes } from "@/lib/storage/scene-audio-storage";

const payloadSchema = z.discriminatedUnion("kind", [
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
  run: async (payload: z.infer<typeof payloadSchema>) => {
    const input = payloadSchema.parse(payload);
    const environment = getSceneAudioEnvironment();
    if (input.kind === "media_asset") {
      const asset = await findMediaAsset(input);
      if (!asset) throw new Error("MEDIA_ASSET_NOT_FOUND");
      if (asset.inspectionStatus === "succeeded")
        return { status: "succeeded" as const };
      try {
        const result = await inspectMediaFile({
          bytes: await downloadMediaAssetBytes(asset.objectKey),
          extension: extension(asset.contentType),
          expectedKind: "video",
          ffprobePath: environment.FFPROBE_PATH,
          ffmpegPath: environment.FFMPEG_PATH,
        });
        if (
          result.metadata.kind !== "video" ||
          result.metadata.durationMilliseconds >
            getMediaLibraryEnvironment().MAX_MEDIA_VIDEO_DURATION_SECONDS * 1000
        )
          throw new Error("VIDEO_DURATION_LIMIT_EXCEEDED");
        await completeMediaAssetInspection({
          ...input,
          metadata: result.metadata,
          warnings: result.warnings,
        });
        return { status: "succeeded" as const, warnings: result.warnings };
      } catch {
        await failMediaAssetInspection({
          ...input,
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
