import { describe, expect, it } from "vitest";
import {
  defaultPresetForAspectRatio,
  getRenderPreset,
  isSupportedRenderDimensions,
  RENDER_PRESETS,
} from "@/lib/render/render-formats";

describe("render formats", () => {
  it("supports exactly the three initial formats", () => {
    expect(new Set(RENDER_PRESETS.map((preset) => preset.aspectRatio))).toEqual(
      new Set(["16:9", "9:16", "1:1"]),
    );
    expect(RENDER_PRESETS).toHaveLength(3);
  });

  it("maps each aspect ratio to its landscape/vertical/square resolution", () => {
    expect(defaultPresetForAspectRatio("16:9")).toMatchObject({
      width: 1920,
      height: 1080,
    });
    expect(defaultPresetForAspectRatio("9:16")).toMatchObject({
      width: 1080,
      height: 1920,
    });
    expect(defaultPresetForAspectRatio("1:1")).toMatchObject({
      width: 1080,
      height: 1080,
    });
  });

  it("looks presets up by id", () => {
    expect(getRenderPreset("landscape_1080p")?.aspectRatio).toBe("16:9");
    expect(getRenderPreset("nope")).toBeNull();
  });

  it("recognizes supported dimensions", () => {
    expect(isSupportedRenderDimensions({ width: 1920, height: 1080 })).toBe(
      true,
    );
    expect(isSupportedRenderDimensions({ width: 1234, height: 567 })).toBe(
      false,
    );
  });
});
