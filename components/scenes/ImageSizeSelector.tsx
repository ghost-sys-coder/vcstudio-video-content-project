"use client";

import type { SceneImageApiSize } from "@/lib/scenes/scene-image-view";

const sizeOptions: Array<{
  value: SceneImageApiSize;
  label: string;
  description: string;
}> = [
  {
    value: "1536x1024",
    label: "Landscape",
    description: "1536 x 1024",
  },
  {
    value: "1024x1536",
    label: "Portrait",
    description: "1024 x 1536",
  },
  {
    value: "1024x1024",
    label: "Square",
    description: "1024 x 1024",
  },
];

export function ImageSizeSelector({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: SceneImageApiSize;
  disabled: boolean;
  onChange: (size: SceneImageApiSize) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
        API image size
      </label>
      <select
        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        id={id}
        onChange={(event) => {
          const option = sizeOptions.find(
            (item) => item.value === event.target.value,
          );
          if (option) onChange(option.value);
        }}
        value={value}
      >
        {sizeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} / {option.description}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Final video framing is cropped or fitted during rendering.
      </p>
    </div>
  );
}
