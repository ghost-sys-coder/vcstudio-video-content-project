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
