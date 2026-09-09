import type { FormatPresetWithCurrentVersion } from "@/db/repositories/format-presets.repository";
import type { FormatInheritableValues } from "@/lib/formats/format-inheritance";

/**
 * A format as the create-project form needs it: enough to seed the fields and
 * to explain afterwards which values came from here.
 */
export interface FormatChoice {
  id: string;
  name: string;
  /** Current version number, so the form can say what it inherited from. */
  versionNumber: number;
  values: FormatInheritableValues;
}

/** Presets with no version yet are omitted: there is nothing to inherit. */
export function toFormatChoices(
  rows: FormatPresetWithCurrentVersion[],
): FormatChoice[] {
  return rows.flatMap((row) =>
    row.currentVersion
      ? [
          {
            id: row.preset.id,
            name: row.preset.name,
            versionNumber: row.currentVersion.versionNumber,
            values: {
              aspectRatio: row.currentVersion.aspectRatio,
              framesPerSecond: row.currentVersion.framesPerSecond,
              targetDurationSeconds: row.currentVersion.targetDurationSeconds,
              maximumBudgetCents: row.currentVersion.defaultMaximumBudgetCents,
              captionsEnabled: row.currentVersion.captionsEnabled,
              voicePresetId: row.currentVersion.voicePresetId,
              stylePresetId: row.currentVersion.stylePresetId,
            },
          },
        ]
      : [],
  );
}
