import type { StylePreset, StylePresetVersion } from "@/db/schema";

/**
 * One style as the workspace settings screen needs it.
 *
 * Distinct from `SceneImageStylePresetView`, which the generate dialog uses:
 * that view only ever lists styles a person may pick right now, so it has no
 * concept of an archived one. This view has to show archived styles in order
 * to offer restoring them, and carries the version number because editing is
 * optimistically locked on it.
 */
export interface StylePresetSettingsView {
  id: string;
  versionId: string;
  name: string;
  description: string;
  version: number;
  isDefault: boolean;
  isArchived: boolean;
  positivePrompt: string;
  negativePrompt: string;
  defaultAspectRatio: "16:9" | "9:16" | "1:1";
  updatedAtLabel: string;
}

function formatUpdatedAt(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function buildStylePresetSettingsView(row: {
  preset: StylePreset;
  version: StylePresetVersion;
}): StylePresetSettingsView {
  return {
    id: row.preset.id,
    versionId: row.version.id,
    name: row.version.name,
    description: row.version.description,
    version: row.version.version,
    isDefault: row.preset.isDefault,
    isArchived: row.preset.archivedAt !== null,
    positivePrompt: row.version.positivePrompt,
    negativePrompt: row.version.negativePrompt,
    defaultAspectRatio: row.version.defaultAspectRatio,
    updatedAtLabel: formatUpdatedAt(row.version.createdAt),
  };
}
