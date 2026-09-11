import type {
  RenderBackgroundAudioData,
  RenderLevelMeterPosition,
} from "@/lib/render/render-timeline-snapshot";

const METER_POSITIONS: readonly RenderLevelMeterPosition[] = [
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
  "topLeft",
  "topCenter",
  "topRight",
];

export type RenderEffectsRow = {
  effects: {
    backgroundMediaAssetId: string | null;
    backgroundVolumePercent: number;
    backgroundLoop: boolean;
    levelMeterEnabled: boolean;
    levelMeterPosition: string;
  };
  backgroundObjectKey: string | null;
  backgroundDeletedAt: Date | null;
  backgroundStatus: string | null;
};

export type ResolvedRenderEffects = {
  backgroundAudio?: RenderBackgroundAudioData;
  levelMeter?: { position: RenderLevelMeterPosition };
  /**
   * Stated rather than inferred. A creator who chose a sound bed and gets a
   * silent video needs to be told which of the two happened, and a render that
   * quietly drops it looks finished.
   */
  droppedBackgroundReason: "deleted" | "notReady" | "missing" | null;
};

/**
 * Turns a stored settings row into what the render snapshot should freeze.
 *
 * The sound bed is dropped, never substituted, when its file is no longer
 * usable: the library soft-deletes rows, so a bed can outlive the file it
 * names, and rendering with some other sound would be worse than rendering
 * without one.
 *
 * A volume of zero drops the bed too. Freezing a silent track into a render
 * costs a download and a decode for nothing audible, and "muted" and "none"
 * are the same video.
 */
export function resolveRenderEffects(
  row: RenderEffectsRow | null,
): ResolvedRenderEffects {
  if (!row) return { droppedBackgroundReason: null };

  const { effects } = row;
  const position = METER_POSITIONS.includes(
    effects.levelMeterPosition as RenderLevelMeterPosition,
  )
    ? (effects.levelMeterPosition as RenderLevelMeterPosition)
    : "bottomRight";

  const levelMeter = effects.levelMeterEnabled ? { position } : undefined;

  if (!effects.backgroundMediaAssetId)
    return {
      ...(levelMeter ? { levelMeter } : {}),
      droppedBackgroundReason: null,
    };

  const dropped: ResolvedRenderEffects["droppedBackgroundReason"] =
    row.backgroundDeletedAt !== null
      ? "deleted"
      : !row.backgroundObjectKey
        ? "missing"
        : row.backgroundStatus !== "ready"
          ? "notReady"
          : null;

  if (dropped !== null || !row.backgroundObjectKey)
    return {
      ...(levelMeter ? { levelMeter } : {}),
      droppedBackgroundReason: dropped ?? "missing",
    };

  if (effects.backgroundVolumePercent <= 0)
    return {
      ...(levelMeter ? { levelMeter } : {}),
      droppedBackgroundReason: null,
    };

  return {
    backgroundAudio: {
      objectKey: row.backgroundObjectKey,
      volumePercent: Math.min(
        100,
        Math.max(0, effects.backgroundVolumePercent),
      ),
      loop: effects.backgroundLoop,
    },
    ...(levelMeter ? { levelMeter } : {}),
    droppedBackgroundReason: null,
  };
}
