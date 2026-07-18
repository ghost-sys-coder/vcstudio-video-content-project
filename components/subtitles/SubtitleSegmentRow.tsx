"use client";

import { useState, useTransition } from "react";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatTimestamp } from "@/lib/subtitles/subtitle-time";
import { cn } from "@/lib/utils";
import type {
  SaveSubtitleSegmentHandler,
  SubtitleSegmentView,
} from "@/lib/subtitles/subtitle-view";

export function SubtitleSegmentRow({
  segment,
  canManage,
  onSave,
}: {
  segment: SubtitleSegmentView;
  canManage: boolean;
  onSave: SaveSubtitleSegmentHandler;
}) {
  const [draft, setDraft] = useState(segment.text);
  const [syncedText, setSyncedText] = useState(segment.text);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset the editor when the derived text changes (granularity switch, audio
  // re-approval) using the "adjust state during render" pattern rather than an
  // effect, so there is no cascading re-render.
  if (segment.text !== syncedText) {
    setSyncedText(segment.text);
    setDraft(segment.text);
  }

  const dirty = draft.trim() !== segment.text.trim();

  const save = (text: string) =>
    startTransition(async () => {
      setError(null);
      const result = await onSave({ segmentKey: segment.key, text });
      if (!result.success) setError(result.error);
    });

  return (
    <article
      className={cn(
        "space-y-2 rounded-lg bg-card p-3 ring-1 ring-inset",
        segment.exceedsMaxDuration
          ? "ring-amber-200 dark:ring-amber-900"
          : "ring-foreground/10",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-semibold">
          Scene {segment.sceneNumber}
          <span className="ml-1 opacity-60">#{segment.index + 1}</span>
        </span>
        <span className="flex items-center gap-2 font-mono tabular-nums">
          <span>
            {formatTimestamp(segment.startMilliseconds, ",")} →{" "}
            {formatTimestamp(segment.endMilliseconds, ",")}
          </span>
          {segment.isOverridden ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Edited
            </span>
          ) : null}
          {segment.exceedsMaxDuration ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Long
            </span>
          ) : null}
        </span>
      </div>

      {canManage ? (
        <Textarea
          aria-label={`Caption text for scene ${segment.sceneNumber} segment ${segment.index + 1}`}
          className="min-h-14 text-sm"
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
      ) : (
        <p className="text-sm text-foreground/90">{segment.text}</p>
      )}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex items-center gap-2">
          <Button
            disabled={!dirty || pending}
            onClick={() => save(draft)}
            size="sm"
            type="button"
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          {segment.isOverridden ? (
            <Button
              disabled={pending}
              onClick={() => save("")}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RotateCcwIcon aria-hidden />
              Reset
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
