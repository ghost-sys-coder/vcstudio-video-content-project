"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
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
      <FormSelect
        disabled={disabled || presets.length === 0}
        id={id}
        onValueChange={(selectedValue) => onChange(selectedValue)}
        value={value}
      >
        {presets.length === 0 ? (
          <SelectItem value="">No style presets available</SelectItem>
        ) : null}
        {presets.map((preset) => (
          <SelectItem key={preset.versionId} value={String(preset.versionId)}>
            {preset.name} / v{preset.version}
            {preset.isDefault ? " / Default" : ""}
          </SelectItem>
        ))}
      </FormSelect>
      <p className="min-h-8 text-xs text-muted-foreground">
        {selectedPreset?.description ??
          "A versioned style preset is required before generation."}
      </p>
    </div>
  );
}
