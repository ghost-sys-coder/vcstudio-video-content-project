import "server-only";

import type { Project } from "@/db/schema";
import { getRenderEnvironment } from "@/lib/env/server";
import { buildRenderTimelineSnapshot } from "@/lib/render/build-render-snapshot";
import { findProjectRenderEffects } from "@/db/repositories/project-render-effects.repository";
import { resolveRenderEffects } from "@/lib/render/resolve-render-effects";
import { resolveSceneCharactersBySceneVersion } from "@/lib/render/resolve-scene-characters";
import {
  buildVideoCompositionInput,
  parseVideoCompositionInput,
  type ValidatedVideoCompositionInput,
} from "@/lib/render/render-composition-input";
import { createRenderAssetDownloadUrls } from "@/lib/storage/video-export-storage";
import {
  buildOutputVariantTimelineContext,
  resolveProjectOutputVariant,
} from "@/lib/output-variants/output-variant-context";
import { findShortCompositionWithClips } from "@/db/repositories/shorts.repository";
import { buildShortTimeline } from "@/lib/shorts/short-timeline";
import { resolveShortClips } from "@/lib/shorts/short-anchors";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import { collectRenderAssetObjectKeys } from "@/lib/render/render-asset-keys";

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
  outputVariantId?: string | null;
  shortCompositionId?: string | null;
}): Promise<RenderPreviewResult> {
  const environment = getRenderEnvironment();
  const outputVariant = await resolveProjectOutputVariant(input);
  const context = await buildOutputVariantTimelineContext({
    workspaceId: input.workspaceId,
    project: input.project,
    outputVariant,
  });
  if (context.timeline.status !== "ready") return { status: "invalid" };

  let renderTimeline = context.timeline.timeline;
  if (input.shortCompositionId) {
    const short = await findShortCompositionWithClips({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      shortCompositionId: input.shortCompositionId,
    });
    if (!short || short.composition.outputVariantId !== outputVariant.id)
      return { status: "invalid" };
    const currentScenes = await listCurrentScenes({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
    });
    const resolved = resolveShortClips(
      short.clips,
      renderTimeline,
      currentScenes,
    );
    if (resolved.needsReview) return { status: "invalid" };
    renderTimeline = buildShortTimeline({
      source: renderTimeline,
      clips: resolved.clips.map((clip) => ({
        id: clip.id,
        sourceSceneId: clip.sourceSceneId,
        sourceSceneVersionId: clip.sourceSceneVersionId,
        position: clip.position,
        sourceStartMilliseconds: clip.sourceStartMilliseconds,
        sourceEndMilliseconds: clip.sourceEndMilliseconds,
        transition: clip.transition === "fade" ? "fade" : "cut",
      })),
      width: outputVariant.width,
      height: outputVariant.height,
    }).timeline;
  }

  const charactersBySceneVersionId =
    input.project.videoKind === "animatedCharacter"
      ? await resolveSceneCharactersBySceneVersion({
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          sceneVersionIds: renderTimeline.scenes.map(
            (scene) => scene.sceneVersionId,
          ),
        })
      : undefined;

  // Presentation effects are resolved here rather than inside the builder so
  // the builder stays a pure transform of the timeline, and so a bed whose
  // file has gone is dropped once, in one place, for both render paths.
  const renderEffects = resolveRenderEffects(
    await findProjectRenderEffects({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
    }),
  );

  const snapshot = buildRenderTimelineSnapshot({
    timeline: renderTimeline,
    captionStyle: context.captionStyle,
    includeCaptions: true,
    includeWatermark: environment.VIDEO_WATERMARK_TEXT.length > 0,
    charactersBySceneVersionId,
    effects: renderEffects,
  });

  const objectKeys = collectRenderAssetObjectKeys(snapshot);
  // Sign for the whole preview session: a full-length preview can play and be
  // replayed for minutes, and the rolling preloader fetches later scenes on
  // demand, so a short-lived URL would expire mid-session and stall playback.
  const assetUrls = await createRenderAssetDownloadUrls(
    objectKeys,
    environment.VIDEO_PREVIEW_URL_EXPIRY_SECONDS,
  );

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
