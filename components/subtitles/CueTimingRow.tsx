"use client";

import { ScissorsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaptionCue } from "@/lib/subtitles/cue-editing";

function toSeconds(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(2);
}

/**
 * One editable cue: its words, its start, its end.
 *
 * Times are entered in seconds because that is how a person reads a waveform,
 * and converted to whole milliseconds on the way out, since every stored and
 * rendered time in this application is an integer millisecond. Rounding here
 * rather than at save time means the number shown is the number stored.
 */
export function CueTimingRow({
  cue,
  index,
  disabled,
  onChangeText,
  onChangeTime,
  onSplit,
  onMerge,
  canMerge,
}: {
  cue: CaptionCue;
  index: number;
  disabled: boolean;
  onChangeText: (text: string) => void;
  onChangeTime: (edge: "start" | "end", milliseconds: number) => void;
  onSplit: (atCharacter: number) => void;
  onMerge: () => void;
  canMerge: boolean;
}) {
  return (
    <li className="space-y-2 rounded-lg border p-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 w-5 shrink-0 text-right text-xs text-muted-foreground">
          {index + 1}
        </span>
        <textarea
          aria-label={`Line ${index + 1} text`}
          className="min-h-9 w-full resize-y rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={disabled}
          id={`cue-text-${index}`}
          onChange={(event) => onChangeText(event.target.value)}
          rows={2}
          value={cue.text}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3 pl-7">
        <label className="text-xs" htmlFor={`cue-start-${index}`}>
          <span className="block text-muted-foreground">Start (s)</span>
          <input
            className="mt-0.5 h-8 w-24 rounded-lg border border-input bg-background px-2 text-sm tabular-nums"
            disabled={disabled}
            id={`cue-start-${index}`}
            min={0}
            onChange={(event) =>
              onChangeTime(
                "start",
                Math.round(Number(event.target.value) * 1000),
              )
            }
            step={0.01}
            type="number"
            value={toSeconds(cue.startMilliseconds)}
          />
        </label>
        <label className="text-xs" htmlFor={`cue-end-${index}`}>
          <span className="block text-muted-foreground">End (s)</span>
          <input
            className="mt-0.5 h-8 w-24 rounded-lg border border-input bg-background px-2 text-sm tabular-nums"
            disabled={disabled}
            id={`cue-end-${index}`}
            min={0}
            onChange={(event) =>
              onChangeTime("end", Math.round(Number(event.target.value) * 1000))
            }
            step={0.01}
            type="number"
            value={toSeconds(cue.endMilliseconds)}
          />
        </label>
        <Button
          disabled={disabled}
          onClick={() => onSplit(Math.floor(cue.text.length / 2))}
          size="sm"
          type="button"
          variant="outline"
        >
          <ScissorsIcon aria-hidden className="size-3.5" />
          Split
        </Button>
        <Button
          disabled={disabled || !canMerge}
          onClick={onMerge}
          size="sm"
          type="button"
          variant="outline"
        >
          Merge with next
        </Button>
      </div>
    </li>
  );
}
