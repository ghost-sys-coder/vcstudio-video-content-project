import "server-only";

import type { Project } from "@/db/schema";
import { getRenderEnvironment } from "@/lib/env/server";
import { buildRenderTimelineSnapshot } from "@/lib/render/build-render-snapshot";
import {
  buildVideoCompositionInput,
  parseVideoCompositionInput,
  type ValidatedVideoCompositionInput,
} from "@/lib/render/render-composition-input";
import { createRenderAssetDownloadUrls } from "@/lib/storage/video-export-storage";
import { buildSubtitleContext } from "@/lib/subtitles/subtitle-workspace-details";

export type RenderPreviewResult =
  | { status: "ready"; input: ValidatedVideoCompositionInput }
  | { status: "invalid" };

/**
 * Builds the composition props for the in-browser Remotion preview: the same
 * frozen timeline the real render uses, with scene assets resolved to
 * short-lived signed URLs the player can fetch. Captions are shown and the
 * watermark applied so the preview matches the export.
 */
export async function loadRenderPreview(input: {
  workspaceId: string;
  project: Project;
}): Promise<RenderPreviewResult> {
  const environment = getRenderEnvironment();
  const context = await buildSubtitleContext({
    workspaceId: input.workspaceId,
    project: input.project,
  });
  if (context.timeline.status !== "ready") return { status: "invalid" };

  const snapshot = buildRenderTimelineSnapshot({
    timeline: context.timeline.timeline,
    captionStyle: context.captionStyle,
    includeCaptions: true,
    includeWatermark: environment.VIDEO_WATERMARK_TEXT.length > 0,
  });

  const objectKeys = snapshot.scenes.flatMap((scene) => [
    scene.image.objectKey,
    scene.audio.objectKey,
  ]);
  const assetUrls = await createRenderAssetDownloadUrls(objectKeys);

  const compositionInput = parseVideoCompositionInput(
    buildVideoCompositionInput({
      snapshot,
      imageUrlByObjectKey: assetUrls,
      audioUrlByObjectKey: assetUrls,
      watermarkText: snapshot.includeWatermark
        ? environment.VIDEO_WATERMARK_TEXT
        : "",
    }),
  );

  return { status: "ready", input: compositionInput };
}
