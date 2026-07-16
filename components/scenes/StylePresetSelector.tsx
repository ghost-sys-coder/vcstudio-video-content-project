"use client";

import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import { Label } from "@/components/ui/label";

export function StylePresetSelector({
  id,
  presets,
  value,
  disabled,
  onChange,
}: {
  id: string;
  presets: SceneImageStylePresetView[];
  value: string;
  disabled: boolean;
  onChange: (stylePresetVersionId: string) => void;
}) {
  const selectedPreset = presets.find((preset) => preset.versionId === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Visual style</Label>
      <select
        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || presets.length === 0}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {presets.length === 0 ? (
          <option value="">No style presets available</option>
        ) : null}
        {presets.map((preset) => (
          <option key={preset.versionId} value={preset.versionId}>
            {preset.name} / v{preset.version}
            {preset.isDefault ? " / Default" : ""}
          </option>
        ))}
      </select>
      <p className="min-h-8 text-xs text-muted-foreground">
        {selectedPreset?.description ??
          "A versioned style preset is required before generation."}
      </p>
    </div>
  );
}
