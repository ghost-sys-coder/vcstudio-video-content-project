"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CaptionStyleData,
  SubtitlePosition,
} from "@/lib/subtitles/caption-style-data";

const POSITIONS: SubtitlePosition[] = ["bottom", "middle", "top"];

/**
 * Edits caption style. On save the assembled style is validated server-side by
 * the canonical caption-style schema before it is persisted, so out-of-range
 * values are rejected rather than rendered.
 */
export function CaptionStyleForm({
  captionStyle,
  canManage,
  onSave,
}: {
  captionStyle: CaptionStyleData;
  canManage: boolean;
  onSave: (style: CaptionStyleData) => Promise<{
    success: boolean;
    error: string | null;
  }>;
}) {
  const [style, setStyle] = useState<CaptionStyleData>(captionStyle);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<Key extends keyof CaptionStyleData>(
    key: Key,
    value: CaptionStyleData[Key],
  ) {
    setSaved(false);
    setStyle((current) => ({ ...current, [key]: value }));
  }

  const numberField = (
    key: keyof CaptionStyleData,
    label: string,
    props: { min: number; max: number; step: number },
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={`caption-${key}`}>
        {label}
      </Label>
      <Input
        disabled={!canManage}
        id={`caption-${key}`}
        max={props.max}
        min={props.min}
        onChange={(event) =>
          update(
            key,
            Number(event.target.value) as CaptionStyleData[typeof key],
          )
        }
        step={props.step}
        type="number"
        value={String(style[key])}
      />
    </div>
  );

  const colorField = (key: keyof CaptionStyleData, label: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor={`caption-${key}`}>
        {label}
      </Label>
      <input
        className="h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canManage}
        id={`caption-${key}`}
        onChange={(event) =>
          update(key, event.target.value as CaptionStyleData[typeof key])
        }
        type="color"
        value={String(style[key])}
      />
    </div>
  );

  return (
    <section aria-label="Caption style" className="space-y-3">
      <h2 className="text-sm font-semibold">Caption style</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="caption-fontFamily">
            Font family
          </Label>
          <Input
            disabled={!canManage}
            id="caption-fontFamily"
            onChange={(event) => update("fontFamily", event.target.value)}
            value={style.fontFamily}
          />
        </div>

        {numberField("fontSizePercent", "Font size (% height)", {
          min: 1,
          max: 20,
          step: 0.5,
        })}

        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="caption-position">
            Position
          </Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-50"
            disabled={!canManage}
            id="caption-position"
            onChange={(event) =>
              update("position", event.target.value as SubtitlePosition)
            }
            value={style.position}
          >
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>

        {colorField("primaryColor", "Text color")}
        {colorField("outlineColor", "Outline color")}
        {colorField("backgroundColor", "Background color")}

        {numberField("backgroundOpacityPercent", "Background opacity (%)", {
          min: 0,
          max: 100,
          step: 5,
        })}
        {numberField("maxLineCharacters", "Max line characters", {
          min: 16,
          max: 120,
          step: 1,
        })}
        {numberField("safeMarginPercent", "Safe margin (%)", {
          min: 0,
          max: 25,
          step: 1,
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={style.bold}
            className="size-4 accent-primary"
            disabled={!canManage}
            onChange={(event) => update("bold", event.target.checked)}
            type="checkbox"
          />
          Bold
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={style.uppercase}
            className="size-4 accent-primary"
            disabled={!canManage}
            onChange={(event) => update("uppercase", event.target.checked)}
            type="checkbox"
          />
          Uppercase
        </label>
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex items-center gap-3">
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await onSave(style);
                if (result.success) setSaved(true);
                else setError(result.error);
              })
            }
            size="sm"
            type="button"
          >
            {pending ? "Saving…" : "Save caption style"}
          </Button>
          {saved ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Saved
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
