import { z } from "zod";
import { captionStyleSchema } from "@/lib/subtitles/caption-style";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";
import type {
  VideoCompositionInput,
  VideoCompositionScene,
} from "@/lib/render/video-composition-data";

export const renderCameraMotionSchema = z.enum([
  "none",
  "zoomIn",
  "zoomOut",
  "panLeft",
  "panRight",
  "panUp",
  "panDown",
]);

export const renderSceneTransitionSchema = z.enum(["cut", "fade"]);

export const renderCaptionSchema = z
  .object({
    text: z.string(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().nonnegative(),
  })
  .refine((caption) => caption.endFrame >= caption.startFrame, {
    message: "Caption endFrame must not precede startFrame.",
  });

const videoCompositionSceneSchema = z
  .object({
    sceneId: z.uuid(),
    sceneNumber: z.number().int().positive(),
    startFrame: z.number().int().nonnegative(),
    durationFrames: z.number().int().positive(),
    cameraMotion: renderCameraMotionSchema,
    transition: renderSceneTransitionSchema,
    imageUrl: z.url(),
    audioUrl: z.url(),
    captions: z.array(renderCaptionSchema),
  })
  .strict();

/**
 * Validates the resolved composition props before they are handed to Remotion.
 * A malformed timeline must never reach the renderer, so geometry, framerate,
 * frame indices, and asset URLs are all bounded here. This is the
 * "composition input validation" the renderer relies on.
 */
export const videoCompositionInputSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    framesPerSecond: z.number().int().min(1).max(120),
    durationInFrames: z.number().int().positive(),
    includeCaptions: z.boolean(),
    includeWatermark: z.boolean(),
    watermarkText: z.string(),
    captionStyle: captionStyleSchema,
    scenes: z.array(videoCompositionSceneSchema).min(1),
  })
  .strict();

export type ValidatedVideoCompositionInput = z.infer<
  typeof videoCompositionInputSchema
>;

export function parseVideoCompositionInput(
  value: unknown,
): ValidatedVideoCompositionInput {
  return videoCompositionInputSchema.parse(value);
}

/**
 * Resolves a persisted timeline snapshot into composition props by swapping R2
 * object keys for signed URLs. Throws if any asset is missing a resolved URL,
 * because a scene can never render without its image and narration.
 */
export function buildVideoCompositionInput(input: {
  snapshot: RenderTimelineSnapshot;
  imageUrlByObjectKey: Readonly<Record<string, string>>;
  audioUrlByObjectKey: Readonly<Record<string, string>>;
  watermarkText: string;
}): VideoCompositionInput {
  const scenes: VideoCompositionScene[] = input.snapshot.scenes.map((scene) => {
    const imageUrl = input.imageUrlByObjectKey[scene.image.objectKey];
    const audioUrl = input.audioUrlByObjectKey[scene.audio.objectKey];
    if (!imageUrl)
      throw new Error(
        `Missing signed image URL for scene ${scene.sceneNumber}.`,
      );
    if (!audioUrl)
      throw new Error(
        `Missing signed audio URL for scene ${scene.sceneNumber}.`,
      );
    return {
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      startFrame: scene.startFrame,
      durationFrames: scene.durationFrames,
      cameraMotion: scene.cameraMotion,
      transition: scene.transition,
      imageUrl,
      audioUrl,
      captions: input.snapshot.includeCaptions ? scene.captions : [],
    };
  });

  return {
    width: input.snapshot.width,
    height: input.snapshot.height,
    framesPerSecond: input.snapshot.framesPerSecond,
    durationInFrames: input.snapshot.totalFrames,
    includeCaptions: input.snapshot.includeCaptions,
    includeWatermark: input.snapshot.includeWatermark,
    watermarkText: input.watermarkText,
    captionStyle: input.snapshot.captionStyle,
    scenes,
  };
}
