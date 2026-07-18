import type { ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { RenderSceneTransition } from "@/lib/render/render-timeline-snapshot";

const FADE_SECONDS = 0.4;

/**
 * Wraps a scene with its entry transition. "cut" shows the scene immediately;
 * "fade" ramps opacity from 0 over the first {@link FADE_SECONDS}. This keeps
 * transitions to two dependency-free primitives per the phase constraints.
 */
export function SceneTransition({
  transition,
  children,
}: {
  transition: RenderSceneTransition;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = Math.max(1, Math.round(fps * FADE_SECONDS));
  const opacity =
    transition === "fade"
      ? interpolate(frame, [0, fadeFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}
