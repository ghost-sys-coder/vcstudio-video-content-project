import type {
  CaptionStyleData,
  SubtitleGranularity,
} from "@/lib/subtitles/caption-style-data";
import type {
  TimelineIssueSeverity,
  TimelineIssueCode,
} from "@/lib/timeline/video-timeline";
import type { CueTimingSource } from "@/lib/subtitles/cue-timing-source";

export type SubtitleExportFormat = "srt" | "vtt";

export interface SubtitleSegmentView {
  key: string;
  sceneId: string;
  sceneNumber: number;
  index: number;
  text: string;
  isOverridden: boolean;
  startMilliseconds: number;
  endMilliseconds: number;
  durationMilliseconds: number;
  startFrame: number;
  endFrame: number;
  exceedsMaxDuration: boolean;
  /** Where this line's timing came from. Never overstated. */
  timingSource: CueTimingSource;
}

export interface SubtitleSceneSummaryView {
  sceneId: string;
  sceneVersionId: string;
  sceneNumber: number;
  sceneApproved: boolean;
  hasApprovedImage: boolean;
  hasApprovedAudio: boolean;
  segmentCount: number;
  narrationPreview: string;
  /**
   * The approved narration these captions describe, and how long it runs.
   * Both are needed to edit cue times, which are relative to this clip.
   */
  audioGenerationId: string | null;
  audioDurationMilliseconds: number;
  /** Where this scene starts in the project timeline, so a cue editor can
   * convert between the absolute times shown on the track and the
   * scene-relative times a correction is stored as. */
  sceneStartMilliseconds: number;
  /** Revision of any saved corrections, for the optimistic lock. */
  cueRevision: number | null;
  timingSource: CueTimingSource;
}

export interface TimelineValidationIssueView {
  sceneId: string | null;
  sceneNumber: number | null;
  code: TimelineIssueCode;
  severity: TimelineIssueSeverity;
  message: string;
}

export interface TimelineSummaryView {
  status: "ready" | "invalid";
  width: number;
  height: number;
  framesPerSecond: number;
  paddingMilliseconds: number;
  sceneCount: number;
  captionCount: number;
  totalDurationMilliseconds: number;
  totalFrames: number;
  errorCount: number;
  warningCount: number;
  issues: TimelineValidationIssueView[];
}

export interface SubtitleConfigurationView {
  enabled: boolean;
  maxLineCharacters: number;
  minSegmentDurationMilliseconds: number;
  maxSegmentDurationMilliseconds: number;
}

export interface SubtitleWorkspaceView {
  granularity: SubtitleGranularity;
  captionStyle: CaptionStyleData;
  segments: SubtitleSegmentView[];
  scenes: SubtitleSceneSummaryView[];
  timeline: TimelineSummaryView;
  configuration: SubtitleConfigurationView;
  totalDurationMilliseconds: number;
  hasSubtitles: boolean;
  /** The weakest source across every scene, so the page never overstates. */
  timingSource: CueTimingSource;
}

export type SubtitleWorkspaceResponse =
  | { success: true; data: SubtitleWorkspaceView }
  | { success: false; error: string };

export interface SubtitleActionResult {
  success: boolean;
  error: string | null;
}

export type SaveSubtitleSettingsHandler = (input: {
  granularity: SubtitleGranularity;
  captionStyle: CaptionStyleData;
}) => Promise<SubtitleActionResult>;

export type SaveSubtitleSegmentHandler = (input: {
  segmentKey: string;
  text: string;
}) => Promise<SubtitleActionResult>;
