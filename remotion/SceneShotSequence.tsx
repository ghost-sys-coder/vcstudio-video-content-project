import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneImage } from "@/remotion/SceneImage";
import type { VideoCompositionSceneShot } from "@/lib/render/video-composition-data";

/** Length of the dissolve between two stills inside one scene. */
const DISSOLVE_SECONDS = 0.35;

/**
 * Draws a scene that changes image partway through.
 *
 * Every shot from its start onward stays mounted, stacked in order, and each
 * one after the first fades in over the one beneath it. That is what produces a
 * dissolve rather than a jump: a plain swap would leave one frame with nothing
 * underneath, and `SceneTransition` cannot express this because it is an entry
 * effect wrapping a whole scene, not something between two stills within one.
 *
 * Keeping earlier shots mounted rather than unmounting them is deliberate. The
 * still beneath has to be painted for the fade above it to dissolve into
 * something, and a scene holds a handful of images, so the cost is a few
 * decoded stills for the length of one scene.
 *
 * Frames here are scene-relative because this renders inside the scene's own
 * Sequence, which is also why an earlier scene changing length cannot move
 * these shots.
 */
export function SceneShotSequence({
  sceneId,
  shots,
}: {
  sceneId: string;
  shots: VideoCompositionSceneShot[];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dissolveFrames = Math.max(1, Math.round(fps * DISSOLVE_SECONDS));

  return (
    <AbsoluteFill>
      {shots.map((shot, index) => {
        // The first shot is simply the base layer: it has nothing to dissolve
        // from, and fading it in would darken the start of every scene.
        if (index > 0 && frame < shot.startFrame - dissolveFrames) return null;

        const opacity =
          index === 0
            ? 1
            : interpolate(
                frame,
                [shot.startFrame - dissolveFrames, shot.startFrame],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

        return (
          <AbsoluteFill key={`${sceneId}-shot-${index}`} style={{ opacity }}>
            <SceneImage
              framing={shot.framing}
              sceneId={`${sceneId}-shot-${index}`}
              src={shot.imageUrl}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}
