"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { MAX_SHOTS_PER_SCENE } from "@/lib/scenes/shot-timing";

/**
 * Chooses which image of the scene a generation or upload is for.
 *
 * A scene normally holds one image and this stays on "first image", which is
 * exactly what every scene did before. Choosing a later slot lets the scene
 * change image partway through: the images divide the narration between them
 * and each change is placed where a caption line begins, so it lands in a
 * pause in the voice rather than over a word.
 *
 * Offers one slot beyond what already exists, rather than all twelve at once.
 * A list of empty slots invites filling them, and a scene cannot show more
 * images than it has caption lines to change on.
 */
export function SceneShotSelector({
  approvedShotCount,
  disabled,
  id,
  onChange,
  value,
}: {
  approvedShotCount: number;
  disabled: boolean;
  id: string;
  onChange: (shotIndex: number) => void;
  value: number;
}) {
  const offered = Math.min(
    Math.max(approvedShotCount + 1, value + 1, 1),
    MAX_SHOTS_PER_SCENE,
  );
  const options = Array.from({ length: offered }, (_, index) => index);

  return (
    <div className="min-w-0 space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
        Image in this scene
      </label>
      <FormSelect
        disabled={disabled}
        id={id}
        onValueChange={(selectedValue) => onChange(Number(selectedValue))}
        value={value}
      >
        {options.map((index) => (
          <SelectItem key={index} value={String(index)}>
            {index === 0 ? "First image" : `Image ${index + 1}`}
            {index >= approvedShotCount ? " (new)" : ""}
          </SelectItem>
        ))}
      </FormSelect>
      <p className="text-xs text-muted-foreground">
        {value === 0
          ? "The scene's main image. Approving a second image makes the scene change picture partway through."
          : "The scene will change to this image on a caption boundary, so the change lands in a pause rather than over a word."}
      </p>
    </div>
  );
}
