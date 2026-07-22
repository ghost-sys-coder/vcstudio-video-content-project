"use client";

import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShortDraftClip } from "@/lib/shorts/short-editor";

export function ShortClipRow({
  clip,
  index,
  total,
  disabled,
  onMove,
  onRemove,
}: {
  clip: ShortDraftClip;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const duration = clip.sourceEndMilliseconds - clip.sourceStartMilliseconds;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">
          {index + 1}. Scene {clip.sceneNumber}
        </p>
        <p className="text-xs text-muted-foreground">
          {(clip.sourceStartMilliseconds / 1000).toFixed(1)}s–
          {(clip.sourceEndMilliseconds / 1000).toFixed(1)}s ·{" "}
          {(duration / 1000).toFixed(1)}s
        </p>
      </div>
      <div className="flex gap-1">
        <Button
          aria-label="Move clip earlier"
          disabled={disabled || index === 0}
          nativeButton
          onClick={() => onMove(-1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ArrowUpIcon aria-hidden className="size-4" />
        </Button>
        <Button
          aria-label="Move clip later"
          disabled={disabled || index === total - 1}
          nativeButton
          onClick={() => onMove(1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ArrowDownIcon aria-hidden className="size-4" />
        </Button>
        <Button
          aria-label="Remove clip"
          disabled={disabled}
          nativeButton
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2Icon aria-hidden className="size-4" />
        </Button>
      </div>
    </li>
  );
}
