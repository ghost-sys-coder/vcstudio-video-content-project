"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import type { SubtitleGranularity } from "@/lib/subtitles/caption-style-data";

const OPTIONS: { value: SubtitleGranularity; label: string; hint: string }[] = [
  {
    value: "sentence",
    label: "Sentence",
    hint: "One caption per sentence",
  },
  {
    value: "scene",
    label: "Scene",
    hint: "One caption per scene",
  },
];

/**
 * Chooses caption granularity. Switching persists the setting and re-derives the
 * whole track (timing is always recomputed from audio, so no manual edits to
 * timing are needed).
 */
export function SubtitleTrackSelector({
  granularity,
  disabled,
  onChange,
}: {
  granularity: SubtitleGranularity;
  disabled: boolean;
  onChange: (granularity: SubtitleGranularity) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor="subtitle-granularity">
        Caption track
      </Label>
      <FormSelect
        className="min-w-48"
        disabled={disabled || pending}
        id="subtitle-granularity"
        onValueChange={(selectedValue) =>
          startTransition(async () =>
            onChange(selectedValue as SubtitleGranularity),
          )
        }
        value={granularity}
      >
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={String(option.value)}>
            {option.label} — {option.hint}
          </SelectItem>
        ))}
      </FormSelect>
    </div>
  );
}
