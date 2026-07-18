import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  cameraTransformAtProgress,
  cameraTransformToCss,
} from "@/lib/render/camera-motion";
import type { RenderCameraMotion } from "@/lib/render/render-timeline-snapshot";

/**
 * Applies a deterministic Ken Burns style transform to its children based on
 * the scene's normalized progress. The transform math lives in the tested
 * `camera-motion` module so preview and render stay identical.
 */
export function CameraMotion({
  motion,
  durationInFrames,
  children,
}: {
  motion: RenderCameraMotion;
  durationInFrames: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const progress = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);
  const transform = cameraTransformToCss(
    cameraTransformAtProgress(motion, progress),
  );

  return (
    <AbsoluteFill style={{ transform, transformOrigin: "center center" }}>
      {children}
    </AbsoluteFill>
  );
}
