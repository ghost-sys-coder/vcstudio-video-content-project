import { describe, expect, it } from "vitest";
import {
  resolveRenderEffects,
  type RenderEffectsRow,
} from "@/lib/render/resolve-render-effects";

function row(
  overrides: Partial<RenderEffectsRow["effects"]> = {},
  asset: Partial<RenderEffectsRow> = {},
): RenderEffectsRow {
  return {
    effects: {
      backgroundMediaAssetId: "asset-1",
      backgroundVolumePercent: 12,
      backgroundLoop: true,
      levelMeterEnabled: false,
      levelMeterPosition: "bottomRight",
      ...overrides,
    },
    backgroundObjectKey: "media/bed.mp3",
    backgroundDeletedAt: null,
    backgroundStatus: "ready",
    ...asset,
  };
}

describe("a project with no settings at all", () => {
  it("gets neither a bed nor a meter, and reports nothing dropped", () => {
    expect(resolveRenderEffects(null)).toEqual({
      droppedBackgroundReason: null,
    });
  });
});

describe("the sound bed", () => {
  it("is carried with its key, volume and loop", () => {
    expect(resolveRenderEffects(row()).backgroundAudio).toEqual({
      objectKey: "media/bed.mp3",
      volumePercent: 12,
      loop: true,
    });
  });

  it("is absent when none was chosen", () => {
    const resolved = resolveRenderEffects(
      row({ backgroundMediaAssetId: null }),
    );
    expect(resolved.backgroundAudio).toBeUndefined();
    expect(resolved.droppedBackgroundReason).toBeNull();
  });

  it("is dropped, and says so, when the file was deleted from the library", () => {
    // The library soft-deletes, so a bed can outlive the file it names.
    const resolved = resolveRenderEffects(
      row({}, { backgroundDeletedAt: new Date() }),
    );
    expect(resolved.backgroundAudio).toBeUndefined();
    expect(resolved.droppedBackgroundReason).toBe("deleted");
  });

  it("is dropped, and says so, when the upload never finished", () => {
    const resolved = resolveRenderEffects(
      row({}, { backgroundStatus: "pending" }),
    );
    expect(resolved.backgroundAudio).toBeUndefined();
    expect(resolved.droppedBackgroundReason).toBe("notReady");
  });

  it("is dropped, and says so, when the row names a file with no object", () => {
    const resolved = resolveRenderEffects(
      row({}, { backgroundObjectKey: null }),
    );
    expect(resolved.backgroundAudio).toBeUndefined();
    expect(resolved.droppedBackgroundReason).toBe("missing");
  });

  it("never substitutes another sound for a missing one", () => {
    const resolved = resolveRenderEffects(
      row({}, { backgroundDeletedAt: new Date() }),
    );
    expect(resolved.backgroundAudio).toBeUndefined();
  });

  it("is omitted at zero volume, which is the same video as no bed", () => {
    const resolved = resolveRenderEffects(row({ backgroundVolumePercent: 0 }));
    expect(resolved.backgroundAudio).toBeUndefined();
    // Not a failure: the creator muted it deliberately.
    expect(resolved.droppedBackgroundReason).toBeNull();
  });
});

describe("the level meter", () => {
  it("is absent while switched off", () => {
    expect(resolveRenderEffects(row()).levelMeter).toBeUndefined();
  });

  it("carries the chosen corner when switched on", () => {
    expect(
      resolveRenderEffects(
        row({ levelMeterEnabled: true, levelMeterPosition: "topLeft" }),
      ).levelMeter,
    ).toEqual({ position: "topLeft" });
  });

  it("falls back to a known corner rather than passing through an unknown one", () => {
    // The column has a check constraint, so this should be unreachable; a
    // renderer crashing on an unexpected string would be the worse failure.
    expect(
      resolveRenderEffects(
        row({ levelMeterEnabled: true, levelMeterPosition: "middleOfNowhere" }),
      ).levelMeter,
    ).toEqual({ position: "bottomRight" });
  });

  it("survives the bed being dropped, since they are independent", () => {
    const resolved = resolveRenderEffects(
      row({ levelMeterEnabled: true }, { backgroundDeletedAt: new Date() }),
    );
    expect(resolved.levelMeter).toEqual({ position: "bottomRight" });
    expect(resolved.droppedBackgroundReason).toBe("deleted");
  });
});
