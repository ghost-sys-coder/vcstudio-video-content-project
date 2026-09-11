import { z } from "zod";
import { captionStyleSchema } from "@/lib/subtitles/caption-style";

/** Kept in step with `CueTimingSource`; a new source must be added here too. */
const timingSourceSchema = z.enum(["estimated", "pause_adjusted", "manual"]);

const segmentSchema = z.object({
  key: z.string(),
  sceneId: z.uuid(),
  sceneNumber: z.number().int().positive(),
  index: z.number().int().nonnegative(),
  text: z.string(),
  isOverridden: z.boolean(),
  startMilliseconds: z.number().int().nonnegative(),
  endMilliseconds: z.number().int().nonnegative(),
  durationMilliseconds: z.number().int().nonnegative(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  exceedsMaxDuration: z.boolean(),
  timingSource: timingSourceSchema,
});

const sceneSummarySchema = z.object({
  sceneId: z.uuid(),
  sceneVersionId: z.uuid(),
  sceneNumber: z.number().int().positive(),
  sceneApproved: z.boolean(),
  hasApprovedImage: z.boolean(),
  hasApprovedAudio: z.boolean(),
  segmentCount: z.number().int().nonnegative(),
  narrationPreview: z.string(),
  audioGenerationId: z.uuid().nullable(),
  audioDurationMilliseconds: z.number().int().nonnegative(),
  sceneStartMilliseconds: z.number().int().nonnegative(),
  cueRevision: z.number().int().positive().nullable(),
  timingSource: timingSourceSchema,
});

const issueSchema = z.object({
  sceneId: z.uuid().nullable(),
  sceneNumber: z.number().int().positive().nullable(),
  code: z.enum([
    "emptyTimeline",
    "sceneNotApproved",
    "missingImage",
    "missingAudio",
    "missingAudioDuration",
    "invalidDuration",
    "durationMismatch",
  ]),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
});

export const subtitleWorkspaceResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.object({
      granularity: z.enum(["scene", "sentence"]),
      captionStyle: captionStyleSchema,
      segments: z.array(segmentSchema),
      scenes: z.array(sceneSummarySchema),
      timeline: z.object({
        status: z.enum(["ready", "invalid"]),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        framesPerSecond: z.number().int().positive(),
        paddingMilliseconds: z.number().int().nonnegative(),
        sceneCount: z.number().int().nonnegative(),
        captionCount: z.number().int().nonnegative(),
        totalDurationMilliseconds: z.number().int().nonnegative(),
        totalFrames: z.number().int().nonnegative(),
        errorCount: z.number().int().nonnegative(),
        warningCount: z.number().int().nonnegative(),
        issues: z.array(issueSchema),
      }),
      configuration: z.object({
        enabled: z.boolean(),
        maxLineCharacters: z.number().int().positive(),
        minSegmentDurationMilliseconds: z.number().int().nonnegative(),
        maxSegmentDurationMilliseconds: z.number().int().nonnegative(),
      }),
      totalDurationMilliseconds: z.number().int().nonnegative(),
      hasSubtitles: z.boolean(),
      timingSource: timingSourceSchema,
    }),
  }),
  z.object({ success: z.literal(false), error: z.string() }),
]);
