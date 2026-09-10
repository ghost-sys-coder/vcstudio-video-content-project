"use client";

import { ImageOffIcon } from "lucide-react";
import { describeThumbnailUploadTarget } from "@/lib/thumbnails/thumbnail-upload-fit";
import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";

/**
 * The title and thumbnail as a viewer meets them: together, and small.
 *
 * Reviewing a title in a wide text field and a thumbnail at full size hides the
 * failure that actually matters, which is a title that truncates and cover text
 * that is unreadable at the size a feed renders. So this is deliberately
 * constrained to roughly a real listing width, and the title is clamped to two
 * lines the way a listing clamps it.
 *
 * The destination is named underneath rather than assumed, because confirming
 * the intended channel is part of reviewing the package.
 */
export function ReleasePackagePreview({
  projectId,
  platform,
  title,
  destinationLabel,
  thumbnailGenerationId,
  thumbnailAvailable,
}: {
  projectId: string;
  platform: VideoContentPlatform;
  title: string;
  destinationLabel: string;
  thumbnailGenerationId: string | null;
  thumbnailAvailable: boolean;
}) {
  const target = describeThumbnailUploadTarget(platform);
  const showImage = thumbnailGenerationId !== null && thumbnailAvailable;

  return (
    <figure className="w-full max-w-[15.5rem] space-y-1.5">
      <div
        className="relative overflow-hidden rounded-lg border bg-muted"
        style={{ aspectRatio: String(target.previewAspectRatio) }}
      >
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element -- an authenticated redirect route, not a static asset */
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            src={`/api/projects/${projectId}/thumbnails/${thumbnailGenerationId}/asset`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOffIcon aria-hidden className="size-5" />
            <span className="text-[11px]">
              {thumbnailGenerationId ? "Thumbnail gone" : "No thumbnail chosen"}
            </span>
          </div>
        )}
      </div>
      <figcaption className="space-y-0.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug">
          {title.trim() === "" ? (
            <span className="text-muted-foreground">No title chosen</span>
          ) : (
            title
          )}
        </p>
        <p className="text-[11px] text-muted-foreground">{destinationLabel}</p>
      </figcaption>
    </figure>
  );
}
