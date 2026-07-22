import { millisecondsToFrames } from "@/lib/timeline/scene-timeline";
import type { RemotionCaption } from "@/lib/subtitles/remotion-captions";
import type { SceneFramingData } from "@/lib/output-variants/scene-framing";

export type CameraMotion =
  "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "panUp" | "panDown";

export type SceneTransition = "cut" | "fade";

export interface VideoRenderSettings {
  width: number;
  height: number;
  framesPerSecond: number;
  paddingMilliseconds: number;
}

export interface TimelineImageAsset {
  generationId: string;
  objectKey: string;
  width: number | null;
  height: number | null;
  framing?: SceneFramingData;
}

export interface TimelineAudioAsset {
  generationId: string;
  objectKey: string;
  durationMilliseconds: number | null;
  format: string;
}

export interface TimelineSceneAssetInput {
  sceneId: string;
  sceneNumber: number;
  sceneVersionId: string;
  sceneApproved: boolean;
  /** Expected duration from analysis, used only for mismatch warnings. */
  expectedDurationMilliseconds: number | null;
  image: TimelineImageAsset | null;
  audio: TimelineAudioAsset | null;
  cameraMotion?: CameraMotion;
  transition?: SceneTransition;
}

export interface VideoTimelineScene {
  sceneId: string;
  sceneNumber: number;
  sceneVersionId: string;
  startMilliseconds: number;
  endMilliseconds: number;
  durationMilliseconds: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  image: TimelineImageAsset;
  audio: Required<Pick<TimelineAudioAsset, "durationMilliseconds">> &
    TimelineAudioAsset;
  audioTrimBeforeFrames?: number;
  cameraMotion: CameraMotion;
  transition: SceneTransition;
  captions: RemotionCaption[];
}

export interface VideoTimeline {
  scenes: VideoTimelineScene[];
  width: number;
  height: number;
  framesPerSecond: number;
  paddingMilliseconds: number;
  totalDurationMilliseconds: number;
  totalFrames: number;
  captionCount: number;
}

export type TimelineIssueSeverity = "error" | "warning";

export type TimelineIssueCode =
  | "emptyTimeline"
  | "sceneNotApproved"
  | "missingImage"
  | "missingAudio"
  | "missingAudioDuration"
  | "invalidDuration"
  | "durationMismatch";

export interface TimelineValidationIssue {
  sceneId: string | null;
  sceneNumber: number | null;
  code: TimelineIssueCode;
  severity: TimelineIssueSeverity;
  message: string;
}

export interface TimelineValidationReport {
  issues: TimelineValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export type BuildVideoTimelineResult =
  | {
      status: "ready";
      timeline: VideoTimeline;
      report: TimelineValidationReport;
    }
  | { status: "invalid"; report: TimelineValidationReport };

function buildReport(
  issues: TimelineValidationIssue[],
): TimelineValidationReport {
  return {
    issues,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
  };
}

/**
 * Builds a deterministic {@link VideoTimeline} from approved scene assets.
 *
 * Construction is rejected (status `invalid`) when any required asset is
 * missing; the returned report lists every blocking issue by scene so the UI
 * can render an actionable checklist. Duration mismatches between the approved
 * audio and the analysis estimate are reported as non-blocking warnings because
 * the measured audio duration is authoritative for timing.
 */
export function buildVideoTimeline(input: {
  scenes: TimelineSceneAssetInput[];
  renderSettings: VideoRenderSettings;
  captionsBySceneId?: Readonly<Record<string, RemotionCaption[]>>;
  durationMismatchToleranceMilliseconds: number;
}): BuildVideoTimelineResult {
  const { framesPerSecond, paddingMilliseconds } = input.renderSettings;
  if (!Number.isInteger(framesPerSecond) || framesPerSecond <= 0)
    throw new RangeError("Frames per second must be a positive integer.");
  if (!Number.isInteger(paddingMilliseconds) || paddingMilliseconds < 0)
    throw new RangeError("Padding milliseconds must be a nonnegative integer.");

  const ordered = [...input.scenes].sort(
    (left, right) => left.sceneNumber - right.sceneNumber,
  );
  const issues: TimelineValidationIssue[] = [];

  if (ordered.length === 0) {
    issues.push({
      sceneId: null,
      sceneNumber: null,
      code: "emptyTimeline",
      severity: "error",
      message: "This project has no scenes to place on the timeline.",
    });
    return { status: "invalid", report: buildReport(issues) };
  }

  for (const scene of ordered) {
    if (!scene.sceneApproved)
      issues.push({
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        code: "sceneNotApproved",
        severity: "error",
        message: `Scene ${scene.sceneNumber} is not approved.`,
      });
    if (!scene.image)
      issues.push({
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        code: "missingImage",
        severity: "error",
        message: `Scene ${scene.sceneNumber} has no approved image.`,
      });
    if (!scene.audio)
      issues.push({
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        code: "missingAudio",
        severity: "error",
        message: `Scene ${scene.sceneNumber} has no approved narration audio.`,
      });
    else if (
      scene.audio.durationMilliseconds === null ||
      scene.audio.durationMilliseconds <= 0
    )
      issues.push({
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        code: "missingAudioDuration",
        severity: "error",
        message: `Scene ${scene.sceneNumber} audio has no measured duration yet.`,
      });
  }

  if (issues.some((issue) => issue.severity === "error"))
    return { status: "invalid", report: buildReport(issues) };

  // Every scene is fully approved with assets and a positive audio duration.
  const scenes: VideoTimelineScene[] = [];
  let cursor = 0;
  ordered.forEach((scene, index) => {
    const image = scene.image!;
    const audio = scene.audio!;
    const durationMilliseconds = audio.durationMilliseconds!;

    const startMilliseconds = cursor;
    const endMilliseconds = startMilliseconds + durationMilliseconds;
    const startFrame = millisecondsToFrames(startMilliseconds, framesPerSecond);
    const endFrame = millisecondsToFrames(endMilliseconds, framesPerSecond);

    if (
      scene.expectedDurationMilliseconds !== null &&
      Math.abs(scene.expectedDurationMilliseconds - durationMilliseconds) >
        input.durationMismatchToleranceMilliseconds
    )
      issues.push({
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        code: "durationMismatch",
        severity: "warning",
        message: `Scene ${scene.sceneNumber} narration is ${Math.round(
          durationMilliseconds / 1000,
        )}s but analysis expected ${Math.round(
          scene.expectedDurationMilliseconds / 1000,
        )}s.`,
      });

    scenes.push({
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      sceneVersionId: scene.sceneVersionId,
      startMilliseconds,
      endMilliseconds,
      durationMilliseconds,
      startFrame,
      endFrame,
      durationFrames: endFrame - startFrame,
      image,
      audio: { ...audio, durationMilliseconds },
      cameraMotion: scene.cameraMotion ?? "none",
      transition: scene.transition ?? "cut",
      captions: input.captionsBySceneId?.[scene.sceneId] ?? [],
    });

    cursor =
      endMilliseconds + (index < ordered.length - 1 ? paddingMilliseconds : 0);
  });

  const totalDurationMilliseconds =
    scenes.length > 0 ? scenes[scenes.length - 1]!.endMilliseconds : 0;

  const timeline: VideoTimeline = {
    scenes,
    width: input.renderSettings.width,
    height: input.renderSettings.height,
    framesPerSecond,
    paddingMilliseconds,
    totalDurationMilliseconds,
    totalFrames: millisecondsToFrames(
      totalDurationMilliseconds,
      framesPerSecond,
    ),
    captionCount: scenes.reduce((sum, scene) => sum + scene.captions.length, 0),
  };

  return { status: "ready", timeline, report: buildReport(issues) };
}
