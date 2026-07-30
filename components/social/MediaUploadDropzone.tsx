"use client";

import { useRef, useState } from "react";
import { Loader2Icon, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format/bytes";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import {
  MEDIA_IMAGE_CONTENT_TYPES,
  MEDIA_VIDEO_CONTENT_TYPES,
} from "@/lib/schemas/media-asset";
import { uploadMediaAsset } from "@/lib/storage/upload-media-asset.client";

const ACCEPTED = [
  ...MEDIA_IMAGE_CONTENT_TYPES,
  ...MEDIA_VIDEO_CONTENT_TYPES,
].join(",");

type UploadFailure = { fileName: string; message: string };

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
  workspaceId,
}: {
  maxImageBytes: number;
  maxVideoBytes: number;
  onUploaded: (assets: MediaAssetView[]) => void;
  workspaceId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [failures, setFailures] = useState<UploadFailure[]>([]);

  const isUploading = pendingFileName !== null;

  async function uploadAll(files: File[]) {
    if (files.length === 0 || isUploading) return;
    setFailures([]);
    const uploaded: MediaAssetView[] = [];
    const failed: UploadFailure[] = [];

    for (const file of files) {
      setPendingFileName(file.name);
      try {
        uploaded.push(await uploadMediaAsset({ workspaceId, file }));
      } catch (error) {
        failed.push({
          fileName: file.name,
          message:
            error instanceof Error
              ? error.message
              : "That file could not be uploaded.",
        });
      }
    }

    setPendingFileName(null);
    setFailures(failed);
    if (uploaded.length > 0) onUploaded(uploaded);
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors ${
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
            Drop images or videos here to add them to the library
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
              Uploading {pendingFileName}
            </>
          ) : (
            "Choose files"
          )}
        </Button>
        <input
          accept={ACCEPTED}
          className="sr-only"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void uploadAll(files);
          }}
          ref={inputRef}
          type="file"
        />
      </div>

      <div aria-live="polite">
        {failures.length > 0 ? (
          <ul className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {failures.map((failure) => (
              <li key={failure.fileName}>
                <span className="font-medium">{failure.fileName}</span> —{" "}
                {failure.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
