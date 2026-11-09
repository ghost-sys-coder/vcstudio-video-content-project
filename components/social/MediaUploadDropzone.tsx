"use client";

import { useRef, useState } from "react";
import { Loader2Icon, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaUploadProgress } from "@/components/social/MediaUploadProgress";
import { useMediaUploadQueue } from "@/hooks/useMediaUploadQueue";
import { formatBytes } from "@/lib/format/bytes";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import {
  MEDIA_IMAGE_CONTENT_TYPES,
  MEDIA_VIDEO_CONTENT_TYPES,
} from "@/lib/schemas/media-asset";

const ACCEPTED = [
  ...MEDIA_IMAGE_CONTENT_TYPES,
  ...MEDIA_VIDEO_CONTENT_TYPES,
].join(",");

/**
 * Drop target for library uploads.
 *
 * Files are uploaded one at a time rather than in parallel: each one streams
 * directly to R2, and a browser fanning out several large videos at once is more
 * likely to stall than to finish sooner. Every file reports its own outcome, so
 * one rejected file never discards the ones that succeeded.
 */
export function MediaUploadDropzone({
  maxImageBytes,
  maxVideoBytes,
  onUploaded,
  onProcessing,
  workspaceId,
  destination,
}: {
  maxImageBytes: number;
  maxVideoBytes: number;
  onUploaded: (assets: MediaAssetView[]) => void;
  onProcessing?: (assets: MediaAssetView[]) => void;
  workspaceId: string;
  destination?: "library" | "post";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { active, failures, processingCount, uploadedCount, uploadAll } =
    useMediaUploadQueue({ workspaceId, onUploaded, onProcessing });
  const isUploading = active !== null;

  return (
    <div className="min-w-0 space-y-2">
      <div
        className={`flex min-w-0 flex-col items-center gap-3 rounded-xl border border-dashed p-4 text-center transition-colors sm:p-8 ${
          isDragging ? "border-primary bg-primary/5" : "bg-muted/30"
        }`}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void uploadAll(Array.from(event.dataTransfer.files));
        }}
      >
        <UploadCloudIcon aria-hidden className="size-6 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {(destination ?? (onProcessing ? "post" : "library")) === "post"
              ? "Drop images or videos here to add them to this post"
              : "Drop images or videos here to add them to the library"}
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, GIF up to {formatBytes(maxImageBytes)} · MP4, MOV,
            WebM up to {formatBytes(maxVideoBytes)}
          </p>
        </div>
        <Button
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          {isUploading ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Upload in progress
            </>
          ) : (
            "Choose files"
          )}
        </Button>
        <input
          accept={ACCEPTED}
          className="sr-only"
          disabled={isUploading}
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void uploadAll(files);
          }}
          ref={inputRef}
          type="file"
        />
        {active ? <MediaUploadProgress upload={active} /> : null}
      </div>

      <div aria-live="polite">
        {uploadedCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            {uploadedCount} file{uploadedCount === 1 ? "" : "s"} uploaded.
          </p>
        ) : null}
        {processingCount > 0 && !onProcessing ? (
          <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
            {processingCount} video{processingCount === 1 ? " is" : "s are"}{" "}
            being verified. It will appear in the library after server-side
            inspection succeeds.
          </p>
        ) : null}
        {failures.length > 0 ? (
          <ul className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {failures.map((failure) => (
              <li className="break-words" key={failure.fileName}>
                <span className="break-all font-medium">
                  {failure.fileName}
                </span>{" "}
                — {failure.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
