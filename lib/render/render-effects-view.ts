import "server-only";

import { findProjectRenderEffects } from "@/db/repositories/project-render-effects.repository";
import { listMediaAssets } from "@/db/repositories/media-assets.repository";
import { resolveRenderEffects } from "@/lib/render/resolve-render-effects";
import type { LevelMeterPosition } from "@/lib/schemas/render-effects";

export interface RenderEffectsAudioChoice {
  id: string;
  title: string;
}

export interface RenderEffectsView {
  backgroundMediaAssetId: string | null;
  backgroundVolumePercent: number;
  backgroundLoop: boolean;
  levelMeterEnabled: boolean;
  levelMeterPosition: LevelMeterPosition;
  /**
   * Null before the project has ever saved these, which is what tells the form
   * to create the row rather than to replace a revision that does not exist.
   */
  revision: number | null;
  availableAudio: RenderEffectsAudioChoice[];
  droppedBackgroundReason: "deleted" | "notReady" | "missing" | null;
}

/**
 * Defaults chosen to render exactly what a project renders today: no bed and
 * no meter. A project that has never opened this panel is unaffected by it.
 */
const DEFAULTS = {
  backgroundMediaAssetId: null,
  backgroundVolumePercent: 12,
  backgroundLoop: true,
  levelMeterEnabled: false,
  levelMeterPosition: "bottomRight" as LevelMeterPosition,
  revision: null,
};

export async function loadRenderEffectsView(input: {
  workspaceId: string;
  projectId: string;
}): Promise<RenderEffectsView> {
  const [row, audio] = await Promise.all([
    findProjectRenderEffects(input),
    // Only audio: the picker must not offer an image as a sound bed, and the
    // command refuses one anyway.
    listMediaAssets({ workspaceId: input.workspaceId, kind: "audio" }),
  ]);

  const availableAudio = audio.map((asset) => ({
    id: asset.id,
    title: asset.title || asset.originalFileName,
  }));

  if (!row)
    return { ...DEFAULTS, availableAudio, droppedBackgroundReason: null };

  const resolved = resolveRenderEffects(row);
  return {
    backgroundMediaAssetId: row.effects.backgroundMediaAssetId,
    backgroundVolumePercent: row.effects.backgroundVolumePercent,
    backgroundLoop: row.effects.backgroundLoop,
    levelMeterEnabled: row.effects.levelMeterEnabled,
    levelMeterPosition: (resolved.levelMeter?.position ??
      row.effects.levelMeterPosition) as LevelMeterPosition,
    revision: row.effects.revision,
    availableAudio,
    droppedBackgroundReason: resolved.droppedBackgroundReason,
  };
}
