"use client";

import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";

/**
 * Picks the visual style a project's images default to.
 *
 * The chosen style's wording is shown rather than hidden behind its name. A
 * style is nothing but that wording, and a creator choosing between "Editorial
 * illustration" and "Cinematic photoreal" from names alone is guessing. Seeing
 * the text is also what makes it obvious that a style can be written, which is
 * the point of the editor in workspace settings.
 *
 * Read-only here on purpose: editing the text at project creation would
 * either silently fork a workspace style or silently change it for every other
 * project using it. Both are worse than sending the creator to the one screen
 * where styles are owned and versioned.
 */
export function ProjectStyleField({
  onChange,
  styles,
  value,
}: {
  onChange: (stylePresetId: string) => void;
  styles: SceneImageStylePresetView[];
  value: string;
}) {
  if (styles.length === 0) return null;

  const selected =
    styles.find((style) => style.id === value) ??
    styles.find((style) => style.isDefault) ??
    styles[0];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="project-style-preset">
        Visual style
      </label>
      <select
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
        id="project-style-preset"
        name="stylePresetId"
        onChange={(event) => onChange(event.target.value)}
        value={selected?.id ?? ""}
      >
        {styles.map((style) => (
          <option key={style.id} value={style.id}>
            {style.name}
            {style.isDefault ? " (workspace default)" : ""}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          {selected.description ? (
            <p className="text-xs text-muted-foreground">
              {selected.description}
            </p>
          ) : null}
          <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
            {selected.positivePrompt}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Every scene image in this project starts from this wording. Change
            it, or add a style for another niche, in workspace settings.
          </p>
        </div>
      ) : null}
    </div>
  );
}
