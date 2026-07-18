"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RenderPresetView } from "@/lib/render/render-view";

/**
 * Presents the supported output formats. Only the preset matching the project's
 * aspect ratio is selectable, because scene images are generated at that ratio;
 * other formats are shown but disabled with an explanation.
 */
export function RenderPresetSelector({
  presets,
  selectedPresetId,
  onSelect,
  disabled,
}: {
  presets: RenderPresetView[];
  selectedPresetId: string;
  onSelect: (presetId: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Format</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {presets.map((preset) => {
          const selected = preset.id === selectedPresetId;
          const unavailable = preset.disabled || disabled;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-muted/50",
                unavailable &&
                  "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
              disabled={unavailable}
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              type="button"
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-sm font-semibold">{preset.label}</span>
                {selected ? (
                  <CheckIcon aria-hidden className="size-4 text-primary" />
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {preset.description}
              </span>
              {preset.disabled ? (
                <span className="text-[10px] font-medium text-muted-foreground">
                  Requires a {preset.aspectRatio} project
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
