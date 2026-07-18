import { describe, expect, it } from "vitest";
import {
  cameraTransformAtProgress,
  cameraTransformToCss,
  PAN_AMOUNT_PERCENT,
  PAN_BASE_SCALE,
  ZOOM_AMOUNT,
} from "@/lib/render/camera-motion";
import type { RenderCameraMotion } from "@/lib/render/render-timeline-snapshot";

describe("cameraTransformAtProgress", () => {
  it("holds a static frame for 'none'", () => {
    for (const progress of [0, 0.5, 1]) {
      expect(cameraTransformAtProgress("none", progress)).toEqual({
        scale: 1,
        translateXPercent: 0,
        translateYPercent: 0,
      });
    }
  });

  it("zooms in from 1 to 1 + ZOOM_AMOUNT", () => {
    expect(cameraTransformAtProgress("zoomIn", 0).scale).toBe(1);
    expect(cameraTransformAtProgress("zoomIn", 1).scale).toBeCloseTo(
      1 + ZOOM_AMOUNT,
    );
  });

  it("zooms out as the mirror of zoom in", () => {
    expect(cameraTransformAtProgress("zoomOut", 0).scale).toBeCloseTo(
      1 + ZOOM_AMOUNT,
    );
    expect(cameraTransformAtProgress("zoomOut", 1).scale).toBe(1);
  });

  it("pans within the padded frame without exposing an edge", () => {
    const left = cameraTransformAtProgress("panLeft", 1);
    expect(left.scale).toBe(PAN_BASE_SCALE);
    expect(left.translateXPercent).toBe(-PAN_AMOUNT_PERCENT);
    expect(cameraTransformAtProgress("panRight", 1).translateXPercent).toBe(
      PAN_AMOUNT_PERCENT,
    );
    expect(cameraTransformAtProgress("panUp", 1).translateYPercent).toBe(
      -PAN_AMOUNT_PERCENT,
    );
    expect(cameraTransformAtProgress("panDown", 1).translateYPercent).toBe(
      PAN_AMOUNT_PERCENT,
    );
    // Panning never exposes the frame edge: the translated image stays covered.
    expect(PAN_BASE_SCALE - 1).toBeGreaterThanOrEqual(PAN_AMOUNT_PERCENT / 100);
  });

  it("clamps progress outside [0, 1] and is deterministic", () => {
    expect(cameraTransformAtProgress("zoomIn", -5)).toEqual(
      cameraTransformAtProgress("zoomIn", 0),
    );
    expect(cameraTransformAtProgress("zoomIn", 5)).toEqual(
      cameraTransformAtProgress("zoomIn", 1),
    );
    expect(cameraTransformAtProgress("panRight", 0.42)).toEqual(
      cameraTransformAtProgress("panRight", 0.42),
    );
  });

  it("interpolates zoom monotonically", () => {
    const motions: RenderCameraMotion[] = ["zoomIn"];
    for (const motion of motions) {
      let previous = -Infinity;
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const scale = cameraTransformAtProgress(motion, p).scale;
        expect(scale).toBeGreaterThanOrEqual(previous);
        previous = scale;
      }
    }
  });

  it("renders a css transform string", () => {
    expect(
      cameraTransformToCss({
        scale: 1.1,
        translateXPercent: -4,
        translateYPercent: 0,
      }),
    ).toBe("translate(-4%, 0%) scale(1.1)");
  });
});
