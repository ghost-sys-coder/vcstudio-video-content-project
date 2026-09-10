"use client";

import { CheckIcon } from "lucide-react";
import type { ThumbnailView } from "@/lib/thumbnails/thumbnail-view";
import { cn } from "@/lib/utils";

/**
 * Picks the one thumbnail this release will use.
 *
 * A favourite is not a choice: the gallery's star marks a candidate, and this
 * records what the release actually ships. Only thumbnails that still have an
 * image are offered, so a release cannot be pointed at a deleted one.
 */
export function ReleaseThumbnailChooser({
  projectId,
  thumbnails,
  selectedId,
  disabled,
  onSelect,
}: {
  projectId: string;
  thumbnails: ThumbnailView[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (thumbnailId: string | null) => void;
}) {
  const available = thumbnails.filter(
    (thumbnail) => thumbnail.status === "succeeded" && thumbnail.hasAsset,
  );

  if (available.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        No thumbnail is available for this platform yet. Generate or upload one
        in the gallery above.
      </p>
    );

  return (
    <div
      aria-label="Thumbnail for this release"
      className="flex flex-wrap gap-2"
      role="radiogroup"
    >
      <button
        aria-checked={selectedId === null}
        className={cn(
          "h-14 rounded-md border px-3 text-xs transition-colors",
          selectedId === null
            ? "border-primary bg-primary/10 font-medium"
            : "text-muted-foreground hover:bg-muted",
        )}
        disabled={disabled}
        onClick={() => onSelect(null)}
        role="radio"
        type="button"
      >
        None
      </button>
      {available.map((thumbnail) => {
        const selected = thumbnail.id === selectedId;
        return (
          <button
            aria-checked={selected}
            aria-label={`Use the ${thumbnail.originLabel} thumbnail from ${thumbnail.createdAtLabel}`}
            className={cn(
              "relative h-14 overflow-hidden rounded-md border transition-colors",
              selected
                ? "border-primary ring-2 ring-primary"
                : "hover:bg-muted",
            )}
            disabled={disabled}
            key={thumbnail.id}
            onClick={() => onSelect(thumbnail.id)}
            role="radio"
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated redirect route, not a static asset */}
            <img
              alt=""
              className="h-full w-auto object-cover"
              src={`/api/projects/${projectId}/thumbnails/${thumbnail.id}/asset`}
            />
            {selected ? (
              <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                <CheckIcon aria-hidden className="size-3" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
