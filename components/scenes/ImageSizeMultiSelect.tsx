"use client";

import type { SceneImageApiSize } from "@/lib/scenes/scene-image-view";
import { SCENE_IMAGE_SIZE_OPTIONS } from "@/lib/scenes/scene-image-size-options";

/**
 * Shared by the single-scene workspace and the storyboard bulk dialog. Each
 * selected size becomes its own independent, separately-billed generation —
 * not a crop of one image — so at least one size must stay selected.
 */
export function ImageSizeMultiSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: SceneImageApiSize[];
  disabled: boolean;
  onChange: (sizes: SceneImageApiSize[]) => void;
}) {
  const selected = new Set(value);
  const descriptionId = `${id}-description`;

  return (
    <fieldset
      aria-describedby={descriptionId}
      className="@container space-y-2"
      disabled={disabled}
      id={id}
    >
      <legend className="text-sm font-medium">Image sizes</legend>
      <div className="grid gap-2 @[420px]:grid-cols-3">
        {SCENE_IMAGE_SIZE_OPTIONS.map((option) => {
          const checked = selected.has(option.value);
          const checkboxId = `${id}-${option.value}`;
          const isOnlySelected = checked && selected.size === 1;
          return (
            <label
              className="has-checked:border-foreground has-checked:bg-muted/50 flex min-w-0 cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-50"
              htmlFor={checkboxId}
              key={option.value}
            >
              <input
                checked={checked}
                className="mt-0.5"
                disabled={isOnlySelected}
                id={checkboxId}
                onChange={(event) => {
                  const next = new Set(value);
                  if (event.target.checked) next.add(option.value);
                  else next.delete(option.value);
                  if (next.size > 0) onChange(Array.from(next));
                }}
                type="checkbox"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {option.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" id={descriptionId}>
        Each selected size generates an independent image and is billed
        separately — sizes are never cropped from one another. Final video
        framing for other formats is handled separately during rendering.
      </p>
    </fieldset>
  );
}
