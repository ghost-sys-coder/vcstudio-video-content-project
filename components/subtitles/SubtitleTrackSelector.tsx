"use client";

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
      <select
        className="h-9 min-w-48 rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
        disabled={disabled || pending}
        id="subtitle-granularity"
        onChange={(event) =>
          startTransition(async () =>
            onChange(event.target.value as SubtitleGranularity),
          )
        }
        value={granularity}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} — {option.hint}
          </option>
        ))}
      </select>
    </div>
  );
}
