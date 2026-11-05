import { z } from "zod";
import { captionStyleSchema } from "@/lib/subtitles/caption-style";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";
import type {
  VideoCompositionInput,
  VideoCompositionScene,
} from "@/lib/render/video-composition-data";
import { DEFAULT_SCENE_FRAMING } from "@/lib/output-variants/scene-framing";
import {
  AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ,
  resampleAmplitudeEnvelope,
} from "@/lib/media/amplitude-envelope";

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

export const renderImageFramingSchema = z.object({
  mode: z.enum(["cover", "contain", "outpaint"]),
  focalPointXBps: z.number().int().min(0).max(10000),
  focalPointYBps: z.number().int().min(0).max(10000),
  scaleBps: z.number().int().min(10000).max(30000),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

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

export const videoCompositionSceneCharacterSchema = z
  .object({
    characterId: z.uuid(),
    stageSlot: z.enum(["left", "center", "right"]),
    isSpeaker: z.boolean(),
    faceLeft: z.boolean(),
    idleUrl: z.url(),
    talkOpenUrl: z.url(),
    talkClosedUrl: z.url(),
    blinkUrl: z.url(),
    // Already resampled to one value per frame, 0..1.
    amplitudeEnvelope: z.array(z.number().min(0).max(1)),
  })
  .strict();

const videoCompositionSceneShotSchema = z
  .object({
    imageUrl: z.url(),
    framing: renderImageFramingSchema.optional(),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().nonnegative(),
  })
  .strict()
  .refine((shot) => shot.endFrame > shot.startFrame, {
    message: "A shot must end after it starts.",
  });

const videoCompositionSceneSchema = z
  .object({
    sceneId: z.uuid(),
    sceneNumber: z.number().int().positive(),
    startFrame: z.number().int().nonnegative(),
    durationFrames: z.number().int().positive(),
    cameraMotion: renderCameraMotionSchema,
    transition: renderSceneTransitionSchema,
    imageUrl: z.url().nullable(),
    video: z
      .object({
        url: z.url(),
        trimBeforeFrames: z.number().int().nonnegative(),
        durationFrames: z.number().int().positive(),
        sourceOffsetFrames: z.number().int().nonnegative().optional(),
        loop: z.boolean(),
        fit: z.enum(["contain", "cover"]),
      })
      .strict()
      .optional(),
    imageFraming: renderImageFramingSchema.optional(),
    audioUrl: z.url(),
    audioTrimBeforeFrames: z.number().int().nonnegative().optional(),
    shots: z.array(videoCompositionSceneShotSchema).min(2).optional(),
    narrationEnvelope: z.array(z.number().min(0).max(1)).optional(),
    captions: z.array(renderCaptionSchema),
    characters: z.array(videoCompositionSceneCharacterSchema).optional(),
  })
  .strict()
  .refine(
    (scene) =>
      scene.video
        ? scene.imageUrl === null && !scene.shots
        : Boolean(scene.imageUrl),
    {
      message: "Each scene needs exactly one visual source: an image or video.",
    },
  )
  .refine(
    (scene) =>
      !scene.shots ||
      scene.shots.every(
        (shot, index) =>
          index === 0 || shot.startFrame >= scene.shots![index - 1]!.endFrame,
      ),
    { message: "Shots must not overlap." },
  );

/**
 * Validates the resolved composition props before they are handed to Remotion.
 * A malformed timeline must never reach the renderer, so geometry, framerate,
 * frame indices, and asset URLs are all bounded here. This is the
 * "composition input validation" the renderer relies on.
 */
export const videoCompositionInputSchema = z
  .object({
    mediaVersion: z.literal(2).optional(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    framesPerSecond: z.number().int().min(1).max(120),
    durationInFrames: z.number().int().positive(),
    includeCaptions: z.boolean(),
    includeWatermark: z.boolean(),
    watermarkText: z.string(),
    captionStyle: captionStyleSchema,
    scenes: z.array(videoCompositionSceneSchema).min(1),
    backgroundAudio: z
      .object({
        url: z.url(),
        volume: z.number().min(0).max(1),
        loop: z.boolean(),
      })
      .strict()
      .optional(),
    levelMeter: z
      .object({
        position: z.enum([
          "bottomLeft",
          "bottomCenter",
          "bottomRight",
          "topLeft",
          "topCenter",
          "topRight",
        ]),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (input) =>
      !input.scenes.some((scene) => scene.video) || input.mediaVersion === 2,
    { message: "Video footage requires a version 2 composition." },
  );

export type ValidatedVideoCompositionInput = z.infer<
  typeof videoCompositionInputSchema
>;

export function parseVideoCompositionInput(
  value: unknown,
): ValidatedVideoCompositionInput {
  return videoCompositionInputSchema.parse(value);
}

/**
 * Which way a character should face so a two-hander reads as a conversation.
 *
 * Pose stills are all generated facing the camera, so facing is a free
 * horizontal mirror rather than extra generated art: a character on the right
 * turns to its left (toward the rest of the cast), one on the left stays as
 * drawn, and a character alone on stage keeps facing the viewer.
 */
export function resolveCharacterFacing(
  stageSlot: "left" | "center" | "right",
  allCharacters: readonly { stageSlot: string }[],
): boolean {
  if (allCharacters.length < 2) return false;
  if (stageSlot === "right") return true;
  if (stageSlot === "left") return false;
  // A centered character turns only if someone is actually to its left.
  return allCharacters.some((other) => other.stageSlot === "left");
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
    const imageUrl = scene.image
      ? input.imageUrlByObjectKey[scene.image.objectKey]
      : null;
    const videoUrl = scene.video
      ? input.imageUrlByObjectKey[scene.video.objectKey]
      : null;
    const audioUrl = input.audioUrlByObjectKey[scene.audio.objectKey];
    if (!scene.video && !imageUrl)
      throw new Error(
        `Missing signed image URL for scene ${scene.sceneNumber}.`,
      );
    if (scene.video && !videoUrl)
      throw new Error(
        `Missing signed video URL for scene ${scene.sceneNumber}.`,
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
      imageUrl: imageUrl ?? null,
      imageFraming: scene.image?.framing ?? DEFAULT_SCENE_FRAMING,
      ...(scene.video && videoUrl
        ? {
            video: {
              url: videoUrl,
              trimBeforeFrames: Math.round(
                (scene.video.trimStartMilliseconds *
                  input.snapshot.framesPerSecond) /
                  1000,
              ),
              durationFrames: Math.max(
                1,
                Math.floor(
                  ((scene.video.durationMilliseconds -
                    scene.video.trimStartMilliseconds) *
                    input.snapshot.framesPerSecond) /
                    1000,
                ),
              ),
              sourceOffsetFrames: Math.round(
                ((scene.video.sourceOffsetMilliseconds ?? 0) *
                  input.snapshot.framesPerSecond) /
                  1000,
              ),
              loop: scene.video.loop,
              fit: scene.video.fit,
            },
          }
        : {}),
      audioUrl,
      audioTrimBeforeFrames: scene.audio.trimBeforeFrames ?? 0,
      ...(scene.audio.amplitudeEnvelope?.length
        ? {
            narrationEnvelope: resampleAmplitudeEnvelope({
              envelope: scene.audio.amplitudeEnvelope,
              envelopeSampleRateHz:
                scene.audio.amplitudeSampleRateHz ??
                AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ,
              frameCount: scene.durationFrames,
              framesPerSecond: input.snapshot.framesPerSecond,
            }),
          }
        : {}),
      ...(scene.shots?.length
        ? {
            shots: scene.shots.map((shot) => {
              const shotUrl = input.imageUrlByObjectKey[shot.objectKey];
              // Throwing beats rendering the scene's first image for every
              // shot: a silently single-image scene looks like the feature was
              // never applied, and nothing would report it.
              if (!shotUrl)
                throw new Error(
                  `Missing signed image URL for a shot of scene ${scene.sceneNumber}.`,
                );
              return {
                imageUrl: shotUrl,
                framing: shot.framing ?? DEFAULT_SCENE_FRAMING,
                startFrame: shot.startFrame,
                endFrame: shot.endFrame,
              };
            }),
          }
        : {}),
      captions: input.snapshot.includeCaptions ? scene.captions : [],
      ...(scene.characters?.length
        ? {
            characters: scene.characters.map((character) => {
              const poses = {
                idleUrl: input.imageUrlByObjectKey[character.poses.idle],
                talkOpenUrl:
                  input.imageUrlByObjectKey[character.poses.talkOpen],
                talkClosedUrl:
                  input.imageUrlByObjectKey[character.poses.talkClosed],
                blinkUrl: input.imageUrlByObjectKey[character.poses.blink],
              };
              if (
                !poses.idleUrl ||
                !poses.talkOpenUrl ||
                !poses.talkClosedUrl ||
                !poses.blinkUrl
              )
                throw new Error(
                  `Missing signed pose URL for ${character.name} in scene ${scene.sceneNumber}.`,
                );
              return {
                characterId: character.characterId,
                stageSlot: character.stageSlot,
                isSpeaker: character.isSpeaker,
                faceLeft: resolveCharacterFacing(
                  character.stageSlot,
                  scene.characters ?? [],
                ),
                ...poses,
                amplitudeEnvelope: character.amplitudeEnvelope?.length
                  ? resampleAmplitudeEnvelope({
                      envelope: character.amplitudeEnvelope,
                      envelopeSampleRateHz:
                        character.amplitudeSampleRateHz ??
                        AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ,
                      frameCount: scene.durationFrames,
                      framesPerSecond: input.snapshot.framesPerSecond,
                    })
                  : [],
              };
            }),
          }
        : {}),
    };
  });

  return {
    ...(input.snapshot.mediaVersion
      ? { mediaVersion: input.snapshot.mediaVersion }
      : {}),
    width: input.snapshot.width,
    height: input.snapshot.height,
    framesPerSecond: input.snapshot.framesPerSecond,
    durationInFrames: input.snapshot.totalFrames,
    includeCaptions: input.snapshot.includeCaptions,
    includeWatermark: input.snapshot.includeWatermark,
    watermarkText: input.watermarkText,
    captionStyle: input.snapshot.captionStyle,
    scenes,
    ...(input.snapshot.backgroundAudio
      ? {
          backgroundAudio: {
            url: (() => {
              const url =
                input.audioUrlByObjectKey[
                  input.snapshot.backgroundAudio.objectKey
                ];
              // Throwing beats rendering in silence: a video that quietly
              // lost its sound bed looks finished and is not.
              if (!url)
                throw new Error("Missing signed URL for the background audio.");
              return url;
            })(),
            volume: input.snapshot.backgroundAudio.volumePercent / 100,
            loop: input.snapshot.backgroundAudio.loop,
          },
        }
      : {}),
    ...(input.snapshot.levelMeter
      ? { levelMeter: input.snapshot.levelMeter }
      : {}),
  };
}
