"use client";

import type { SceneImageQuality } from "@/lib/scenes/scene-image-view";

export function ImageQualitySelector({
  idPrefix,
  value,
  draftQuality,
  finalQuality,
  disabled,
  onChange,
}: {
  idPrefix: string;
  value: SceneImageQuality;
  draftQuality: "low";
  finalQuality: "medium";
  disabled: boolean;
  onChange: (quality: SceneImageQuality) => void;
}) {
  const qualityOptions: Array<{
    value: SceneImageQuality;
    label: string;
    description: string;
  }> = [
    {
      value: draftQuality,
      label: "Draft",
      description: "Low quality / fastest and lowest cost",
    },
    {
      value: finalQuality,
      label: "Final",
      description: "Medium quality / recommended final output",
    },
    {
      value: "high",
      label: "High",
      description: "Manual opt-in / highest cost",
    },
  ];

  return (
    <fieldset
      className="@container w-full min-w-0 space-y-2"
      disabled={disabled}
    >
      <legend className="text-sm font-medium">Quality</legend>
      <div className="grid min-w-0 gap-2 @[480px]:grid-cols-3">
        {qualityOptions.map((option) => {
          const id = `${idPrefix}-quality-${option.value}`;
          return (
            <label
              className="has-checked:border-foreground has-checked:bg-muted/60 flex min-w-0 cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-50"
              htmlFor={id}
              key={option.value}
            >
              <input
                checked={value === option.value}
                className="mt-0.5 shrink-0"
                id={id}
                name={`${idPrefix}-quality`}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span className="min-w-0 wrap-anywhere">
                <span className="block text-sm font-medium">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
