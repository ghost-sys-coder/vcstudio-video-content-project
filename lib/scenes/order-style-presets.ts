import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";

/**
 * Orders the styles a generate dialog offers so the first entry is the one it
 * should preselect.
 *
 * Preference order: the style this project was created with, then the
 * workspace default, then everything else in the order the repository gave.
 *
 * Expressing the choice as an ordering rather than as a flag keeps a single
 * meaning for `isDefault` — it is the *workspace* default, everywhere, and the
 * "(default)" label stays true. It also means a dialog needs no extra prop
 * threaded through the storyboard tree to preselect correctly: it takes the
 * first entry.
 *
 * A project whose style was archived, or which predates project-level styles,
 * falls through to the workspace default, which is exactly what such a project
 * did before.
 */
export function orderStylePresetsForProject(
  presets: SceneImageStylePresetView[],
  projectStylePresetVersionId: string | null,
): SceneImageStylePresetView[] {
  const rank = (preset: SceneImageStylePresetView): number => {
    if (
      projectStylePresetVersionId !== null &&
      preset.versionId === projectStylePresetVersionId
    )
      return 0;
    return preset.isDefault ? 1 : 2;
  };

  return presets
    .map((preset, index) => ({ preset, index }))
    .sort((left, right) => {
      const difference = rank(left.preset) - rank(right.preset);
      // Ties keep the repository's order, which is already default-first then
      // by name, so this never reshuffles the rest of the list.
      return difference !== 0 ? difference : left.index - right.index;
    })
    .map((entry) => entry.preset);
}
