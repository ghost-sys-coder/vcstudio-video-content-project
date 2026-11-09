"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { FilmIcon, PlayIcon } from "lucide-react";

export function VideoMediaThumbnail({
  title,
  thumbnailUrl,
}: {
  title: string;
  thumbnailUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  return thumbnailUrl && !failed ? (
    <div className="relative flex size-full items-center justify-center">
      <img
        alt={`Video: ${title}`}
        src={thumbnailUrl}
        className="size-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
      >
        <PlayIcon className="size-5 fill-current" />
      </span>
    </div>
  ) : (
    <div
      aria-label={`Video: ${title}`}
      role="img"
      className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
    >
      <FilmIcon aria-hidden className="size-8" />
      <span className="text-xs">Video</span>
    </div>
  );
}
