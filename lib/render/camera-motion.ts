import type { RenderCameraMotion } from "@/lib/render/render-timeline-snapshot";

export interface CameraTransform {
  /** Uniform scale factor applied to the scene image. */
  scale: number;
  /** Horizontal translation as a percentage of the frame width. */
  translateXPercent: number;
  /** Vertical translation as a percentage of the frame height. */
  translateYPercent: number;
}

/**
 * Motion is deliberately subtle so it reads as production polish rather than a
 * gimmick. Zooms move 8% over the scene; pans slide 4% of the frame. Pans keep
 * a small baseline zoom so translating the image never exposes the frame edge.
 */
export const ZOOM_AMOUNT = 0.08;
export const PAN_AMOUNT_PERCENT = 4;
export const PAN_BASE_SCALE = 1 + ZOOM_AMOUNT;

function clampProgress(progress: number): number {
  if (Number.isNaN(progress)) return 0;
  if (progress < 0) return 0;
  if (progress > 1) return 1;
  return progress;
}

/**
 * The deterministic camera transform for a motion type at a normalized scene
 * progress in [0, 1]. Given the same inputs it always returns the same output,
 * which keeps renders reproducible.
 */
export function cameraTransformAtProgress(
  motion: RenderCameraMotion,
  progress: number,
): CameraTransform {
  const t = clampProgress(progress);
  switch (motion) {
    case "none":
      return { scale: 1, translateXPercent: 0, translateYPercent: 0 };
    case "zoomIn":
      return {
        scale: 1 + ZOOM_AMOUNT * t,
        translateXPercent: 0,
        translateYPercent: 0,
      };
    case "zoomOut":
      return {
        scale: 1 + ZOOM_AMOUNT * (1 - t),
        translateXPercent: 0,
        translateYPercent: 0,
      };
    case "panLeft":
      return {
        scale: PAN_BASE_SCALE,
        translateXPercent: -PAN_AMOUNT_PERCENT * t,
        translateYPercent: 0,
      };
    case "panRight":
      return {
        scale: PAN_BASE_SCALE,
        translateXPercent: PAN_AMOUNT_PERCENT * t,
        translateYPercent: 0,
      };
    case "panUp":
      return {
        scale: PAN_BASE_SCALE,
        translateXPercent: 0,
        translateYPercent: -PAN_AMOUNT_PERCENT * t,
      };
    case "panDown":
      return {
        scale: PAN_BASE_SCALE,
        translateXPercent: 0,
        translateYPercent: PAN_AMOUNT_PERCENT * t,
      };
    default: {
      const exhaustive: never = motion;
      throw new Error(`Unhandled camera motion: ${String(exhaustive)}`);
    }
  }
}

/** Builds the CSS transform string for a camera transform. */
export function cameraTransformToCss(transform: CameraTransform): string {
  return `translate(${transform.translateXPercent}%, ${transform.translateYPercent}%) scale(${transform.scale})`;
}
