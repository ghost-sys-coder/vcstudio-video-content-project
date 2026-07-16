"use client";

import Image from "next/image";
import type { SceneImageReferenceView } from "@/lib/scenes/scene-image-view";
import { Badge } from "@/components/ui/badge";

export function ReferenceAssetSelector({
  id,
  references,
  selectedIds,
  maximumSelected,
  disabled,
  onChange,
}: {
  id: string;
  references: SceneImageReferenceView[];
  selectedIds: string[];
  maximumSelected: number;
  disabled: boolean;
  onChange: (referenceAssetIds: string[]) => void;
}) {
  const selected = new Set(selectedIds);
  const atLimit = selected.size >= maximumSelected;
  const descriptionId = `${id}-description`;

  return (
    <fieldset
      aria-describedby={descriptionId}
      className="space-y-3"
      disabled={disabled}
      id={id}
    >
      <legend className="sr-only">Character references</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-hidden="true" className="text-sm font-medium">
          Character references
        </p>
        <Badge variant="secondary">
          {selected.size} / {maximumSelected} selected
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground" id={descriptionId}>
        No selection uses the image generation endpoint. Selecting references
        uses image editing and preserves character details with high input
        fidelity when the model supports it.
      </p>
      {references.length ? (
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {references.map((reference) => {
            const checked = selected.has(reference.id);
            const checkboxId = `${id}-${reference.id}`;
            return (
              <label
                className="has-checked:border-foreground has-checked:bg-muted/50 grid cursor-pointer grid-cols-[4rem_1fr] gap-3 rounded-xl border p-2 transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-50"
                htmlFor={checkboxId}
                key={reference.id}
              >
                <span className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  <Image
                    alt={`${reference.typeLabel} for ${reference.characterName}`}
                    className="object-cover"
                    fill
                    sizes="64px"
                    src={reference.thumbnailUrl}
                    unoptimized
                  />
                </span>
                <span className="min-w-0 self-center">
                  <span className="flex items-start gap-2">
                    <input
                      checked={checked}
                      className="mt-0.5"
                      disabled={!checked && atLimit}
                      id={checkboxId}
                      onChange={(event) => {
                        const next = new Set(selectedIds);
                        if (event.target.checked) next.add(reference.id);
                        else next.delete(reference.id);
                        onChange(Array.from(next));
                      }}
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {reference.characterName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {reference.typeLabel}
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 block pl-5 text-[0.7rem] text-muted-foreground">
                    {reference.width} x {reference.height}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
          No references are assigned to this scene. The image will be generated
          from the prompt only.
        </div>
      )}
      {atLimit ? (
        <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
          The maximum number of reference assets is selected.
        </p>
      ) : null}
    </fieldset>
  );
}
