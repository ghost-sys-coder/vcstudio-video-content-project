import "server-only";

import type { Project } from "@/db/schema";
import type { SceneVariantFraming } from "@/db/schema";
import {
  getProjectSubtitleSettings,
  listApprovedSceneAudioAssets,
  listApprovedSceneImageAssets,
} from "@/db/repositories/subtitle.repository";
import { listSucceededSceneImageGenerationsByIds } from "@/db/repositories/scene-images.repository";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import {
  getSceneAudioEnvironment,
  getSubtitleEnvironment,
} from "@/lib/env/server";
import {
  coerceCaptionStyle,
  DEFAULT_CAPTION_STYLE,
} from "@/lib/subtitles/caption-style";
import { DEFAULT_SCENE_FRAMING } from "@/lib/output-variants/scene-framing";
import type {
  CaptionStyleData,
  SubtitleGranularity,
  SubtitleSegmentTextOverrides,
} from "@/lib/subtitles/caption-style-data";
import { normalizeNarration } from "@/lib/subtitles/subtitle-segmentation";
import {
  assembleSubtitleTrack,
  type SubtitleTrack,
} from "@/lib/subtitles/subtitle-track";
import type { RemotionCaption } from "@/lib/subtitles/remotion-captions";
import { buildProjectTimeline } from "@/lib/timeline/scene-timeline";
import {
  buildVideoTimeline,
  type BuildVideoTimelineResult,
} from "@/lib/timeline/video-timeline";
import type {
  SubtitleSceneSummaryView,
  SubtitleSegmentView,
  SubtitleWorkspaceView,
  TimelineSummaryView,
} from "@/lib/subtitles/subtitle-view";

interface ApprovedImage {
  generationId: string;
  assetObjectKey: string | null;
  assetWidth: number | null;
  assetHeight: number | null;
}

interface ApprovedAudio {
  generationId: string;
  assetObjectKey: string | null;
  durationMilliseconds: number | null;
  format: string;
}

export interface SubtitleContext {
  granularity: SubtitleGranularity;
  captionStyle: CaptionStyleData;
  overrides: SubtitleSegmentTextOverrides;
  track: SubtitleTrack;
  timeline: BuildVideoTimelineResult;
  scenes: SubtitleSceneSummaryView[];
  maxSegmentDurationMilliseconds: number;
  enabled: boolean;
  minSegmentDurationMilliseconds: number;
  maxLineCharacters: number;
  project: Project;
}

/**
 * Gathers approved scene assets, resolves persisted subtitle settings, and
 * assembles the deterministic subtitle track and video timeline once. Both the
 * workspace view loader and the export route build on this shared context so
 * captions and timing stay identical across preview and export.
 */
export async function buildSubtitleContext(input: {
  workspaceId: string;
  project: Project;
  output?: {
    width: number;
    height: number;
    captionStyle: CaptionStyleData | null;
    framings: SceneVariantFraming[];
  };
}): Promise<SubtitleContext> {
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
  const subtitleEnv = getSubtitleEnvironment();
  const audioEnv = getSceneAudioEnvironment();

  const currentScenes = await listCurrentScenes(scope);
  const sceneVersionIds = currentScenes.map((row) => row.version.id);

  const [settings, approvedImages, approvedAudios, variantImages] =
    await Promise.all([
      getProjectSubtitleSettings(scope),
      listApprovedSceneImageAssets({ ...scope, sceneVersionIds }),
      listApprovedSceneAudioAssets({ ...scope, sceneVersionIds }),
      listSucceededSceneImageGenerationsByIds({
        ...scope,
        generationIds: (input.output?.framings ?? []).map(
          (framing) => framing.sourceImageGenerationId,
        ),
      }),
    ]);

  const imageByVersion = new Map<string, ApprovedImage>(
    approvedImages.map((row) => [row.sceneVersionId, row] as const),
  );
  const audioByVersion = new Map<string, ApprovedAudio>(
    approvedAudios.map((row) => [row.sceneVersionId, row] as const),
  );

  const granularity: SubtitleGranularity = settings?.granularity ?? "sentence";
  const captionStyle: CaptionStyleData = input.output?.captionStyle
    ? coerceCaptionStyle(input.output.captionStyle)
    : settings
      ? coerceCaptionStyle(settings.captionStyle)
      : {
          ...DEFAULT_CAPTION_STYLE,
          maxLineCharacters: subtitleEnv.SUBTITLE_MAX_LINE_CHARACTERS,
        };
  const overrides: SubtitleSegmentTextOverrides =
    settings?.segmentTextOverrides ?? {};
  const framingByVersion = new Map(
    (input.output?.framings ?? []).map((framing) => [
      framing.sceneVersionId,
      framing,
    ]),
  );
  const variantImageById = new Map(
    variantImages.map((image) => [image.id, image] as const),
  );

  // Absolute scene slots come from approved-audio durations plus configured
  // padding, matching the audio-review timeline exactly.
  const slotTimeline = buildProjectTimeline({
    framesPerSecond: input.project.framesPerSecond,
    paddingMilliseconds: audioEnv.AUDIO_SCENE_PADDING_MILLISECONDS,
    scenes: currentScenes.map(({ scene, version }) => ({
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      durationMilliseconds:
        audioByVersion.get(version.id)?.durationMilliseconds ?? 0,
    })),
  });
  const slotBySceneId = new Map(
    slotTimeline.scenes.map((scene) => [scene.sceneId, scene] as const),
  );

  const track = assembleSubtitleTrack(
    currentScenes.map(({ scene, version }) => {
      const slot = slotBySceneId.get(scene.id);
      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: version.id,
        narrationText: version.narrationText,
        startMilliseconds: slot?.startMilliseconds ?? 0,
        endMilliseconds: slot?.endMilliseconds ?? 0,
      };
    }),
    {
      granularity,
      framesPerSecond: input.project.framesPerSecond,
      maxLineCharacters: captionStyle.maxLineCharacters,
      minSegmentDurationMilliseconds:
        subtitleEnv.SUBTITLE_MIN_SEGMENT_DURATION_MILLISECONDS,
      textOverrides: overrides,
    },
  );

  const captionsBySceneId: Record<string, RemotionCaption[]> = {};
  for (const segment of track.segments) {
    (captionsBySceneId[segment.sceneId] ??= []).push({
      text: segment.text,
      startMs: segment.startMilliseconds,
      endMs: segment.endMilliseconds,
      startFrame: segment.startFrame,
      endFrame: segment.endFrame,
    });
  }

  const timeline = buildVideoTimeline({
    renderSettings: {
      width: input.output?.width ?? input.project.width,
      height: input.output?.height ?? input.project.height,
      framesPerSecond: input.project.framesPerSecond,
      paddingMilliseconds: audioEnv.AUDIO_SCENE_PADDING_MILLISECONDS,
    },
    durationMismatchToleranceMilliseconds:
      subtitleEnv.SUBTITLE_DURATION_MISMATCH_TOLERANCE_MILLISECONDS,
    captionsBySceneId,
    scenes: currentScenes.map(({ scene, version }) => {
      const approvedImage = imageByVersion.get(version.id) ?? null;
      const framing = framingByVersion.get(version.id);
      const variantImage = framing
        ? variantImageById.get(framing.sourceImageGenerationId)
        : null;
      const image = variantImage?.assetObjectKey
        ? {
            generationId: variantImage.id,
            assetObjectKey: variantImage.assetObjectKey,
            assetWidth: variantImage.assetWidth,
            assetHeight: variantImage.assetHeight,
          }
        : approvedImage;
      const audio = audioByVersion.get(version.id) ?? null;
      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneVersionId: version.id,
        sceneApproved: scene.status === "approved",
        expectedDurationMilliseconds: version.estimatedDurationMilliseconds,
        image:
          image && image.assetObjectKey
            ? {
                generationId: image.generationId,
                objectKey: image.assetObjectKey,
                width: image.assetWidth,
                height: image.assetHeight,
                framing: (() => {
                  const framing = framingByVersion.get(version.id);
                  if (
                    !framing ||
                    framing.sourceImageGenerationId !== image.generationId
                  )
                    return DEFAULT_SCENE_FRAMING;
                  return {
                    mode: framing.mode === "outpaint" ? "cover" : framing.mode,
                    focalPointXBps: framing.focalPointXBps,
                    focalPointYBps: framing.focalPointYBps,
                    scaleBps: framing.scaleBps,
                    backgroundColor: framing.backgroundColor,
                  };
                })(),
              }
            : null,
        audio:
          audio && audio.assetObjectKey
            ? {
                generationId: audio.generationId,
                objectKey: audio.assetObjectKey,
                durationMilliseconds: audio.durationMilliseconds,
                format: audio.format,
              }
            : null,
      };
    }),
  });

  const segmentCountByScene = new Map<string, number>();
  for (const segment of track.segments)
    segmentCountByScene.set(
      segment.sceneId,
      (segmentCountByScene.get(segment.sceneId) ?? 0) + 1,
    );

  const scenes: SubtitleSceneSummaryView[] = currentScenes.map(
    ({ scene, version }) => {
      const narration = normalizeNarration(version.narrationText);
      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneApproved: scene.status === "approved",
        hasApprovedImage: imageByVersion.has(version.id),
        hasApprovedAudio: audioByVersion.has(version.id),
        segmentCount: segmentCountByScene.get(scene.id) ?? 0,
        narrationPreview:
          narration.length > 160 ? `${narration.slice(0, 160)}…` : narration,
      };
    },
  );

  return {
    granularity,
    captionStyle,
    overrides,
    track,
    timeline,
    scenes,
    maxSegmentDurationMilliseconds:
      subtitleEnv.SUBTITLE_MAX_SEGMENT_DURATION_MILLISECONDS,
    minSegmentDurationMilliseconds:
      subtitleEnv.SUBTITLE_MIN_SEGMENT_DURATION_MILLISECONDS,
    maxLineCharacters: captionStyle.maxLineCharacters,
    enabled: subtitleEnv.ENABLE_SUBTITLES,
    project: input.project,
  };
}

export async function loadSubtitleWorkspace(input: {
  workspaceId: string;
  project: Project;
}): Promise<SubtitleWorkspaceView> {
  const context = await buildSubtitleContext(input);

  const segments: SubtitleSegmentView[] = context.track.segments.map(
    (segment) => {
      const durationMilliseconds =
        segment.endMilliseconds - segment.startMilliseconds;
      const override = context.overrides[segment.key];
      return {
        key: segment.key,
        sceneId: segment.sceneId,
        sceneNumber: segment.sceneNumber,
        index: segment.index,
        text: segment.text,
        isOverridden:
          typeof override === "string" && override.trim().length > 0,
        startMilliseconds: segment.startMilliseconds,
        endMilliseconds: segment.endMilliseconds,
        durationMilliseconds,
        startFrame: segment.startFrame,
        endFrame: segment.endFrame,
        exceedsMaxDuration:
          durationMilliseconds > context.maxSegmentDurationMilliseconds,
      };
    },
  );

  const report = context.timeline.report;
  const timeline: TimelineSummaryView = {
    status: context.timeline.status,
    width: context.project.width,
    height: context.project.height,
    framesPerSecond: context.project.framesPerSecond,
    paddingMilliseconds:
      context.timeline.status === "ready"
        ? context.timeline.timeline.paddingMilliseconds
        : getSceneAudioEnvironment().AUDIO_SCENE_PADDING_MILLISECONDS,
    sceneCount:
      context.timeline.status === "ready"
        ? context.timeline.timeline.scenes.length
        : context.scenes.length,
    captionCount:
      context.timeline.status === "ready"
        ? context.timeline.timeline.captionCount
        : context.track.segments.length,
    totalDurationMilliseconds:
      context.timeline.status === "ready"
        ? context.timeline.timeline.totalDurationMilliseconds
        : 0,
    totalFrames:
      context.timeline.status === "ready"
        ? context.timeline.timeline.totalFrames
        : 0,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    issues: report.issues.map((issue) => ({
      sceneId: issue.sceneId,
      sceneNumber: issue.sceneNumber,
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
    })),
  };

  return {
    granularity: context.granularity,
    captionStyle: context.captionStyle,
    segments,
    scenes: context.scenes,
    timeline,
    configuration: {
      enabled: context.enabled,
      maxLineCharacters: context.maxLineCharacters,
      minSegmentDurationMilliseconds: context.minSegmentDurationMilliseconds,
      maxSegmentDurationMilliseconds: context.maxSegmentDurationMilliseconds,
    },
    totalDurationMilliseconds: context.track.totalDurationMilliseconds,
    hasSubtitles: context.track.segments.length > 0,
  };
}
