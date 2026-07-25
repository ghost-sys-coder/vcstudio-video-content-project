import type { SceneFramingMode } from "@/db/schema";

export interface SceneFramingData {
  mode: SceneFramingMode;
  focalPointXBps: number;
  focalPointYBps: number;
  scaleBps: number;
  backgroundColor: string;
}

export const DEFAULT_SCENE_FRAMING: SceneFramingData = {
  mode: "cover",
  focalPointXBps: 5000,
  focalPointYBps: 5000,
  scaleBps: 10000,
  backgroundColor: "#000000",
};

export function framingObjectPosition(input: {
  focalPointXBps: number;
  focalPointYBps: number;
}): string {
  return `${input.focalPointXBps / 100}% ${input.focalPointYBps / 100}%`;
}

export function framingScale(scaleBps: number): number {
  return scaleBps / 10000;
}

/**
 * Converts a pointer position expressed as a 0-1 fraction of the image
 * container's width/height (from `(clientX - rect.left) / rect.width`,
 * computed by the caller since that needs the DOM) into clamped focal-point
 * basis points, so clicking/dragging on the image and the percentage
 * sliders both write into the same representation.
 */
export function focalPointFromPointerOffset(input: {
  offsetXRatio: number;
  offsetYRatio: number;
}): { focalPointXBps: number; focalPointYBps: number } {
  const toBps = (ratio: number) =>
    Math.round(Math.min(1, Math.max(0, ratio)) * 10000);
  return {
    focalPointXBps: toBps(input.offsetXRatio),
    focalPointYBps: toBps(input.offsetYRatio),
  };
}
