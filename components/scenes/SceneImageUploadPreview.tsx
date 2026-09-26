"use client";

import { ImageIcon } from "lucide-react";
import type { UploadPreview } from "@/lib/scenes/describe-upload-preview";
import { cn } from "@/lib/utils";

const TONE = {
  fits: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  cropped:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  refused:
    "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive",
} as const;

/**
 * The chosen file, shown before it is sent anywhere.
 *
 * The picture is drawn from a local object URL, so nothing is uploaded to look
 * at it. The verdict beside it is the same judgement the upload applies, run
 * here so a refusal arrives while the file picker is still open rather than
 * after a round trip.
 *
 * **The image is displayed whole, not cropped to the target.** Showing the
 * cropped result would hide exactly what the warning is about; the creator
 * needs to see the edges that are at risk in order to decide whether losing
 * them matters.
 */
export function SceneImageUploadPreview({
  fileName,
  previewUrl,
  preview,
  rotationDiffers,
}: {
  fileName: string | null;
  previewUrl: string | null;
  preview: UploadPreview | null;
  /**
   * True when the browser draws this file rotated relative to how it is
   * stored. The upload measures the stored shape, so the two can disagree.
   */
  rotationDiffers: boolean;
}) {
  if (!previewUrl)
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
        <ImageIcon aria-hidden className="size-6" />
        <p className="text-xs">Choose a file to see it here first.</p>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
        {/* A local object URL for a file the creator just chose: next/image
            would need a remote pattern for a URL that changes every time. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={
            fileName ? `Preview of ${fileName}` : "Preview of the chosen image"
          }
          className="max-h-40 max-w-full object-contain"
          src={previewUrl}
        />
      </div>

      {preview ? (
        <p
          className={cn(
            "rounded-lg border px-2.5 py-2 text-xs",
            TONE[preview.verdict],
          )}
          role="status"
        >
          {preview.message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Measuring the image…</p>
      )}

      {rotationDiffers ? (
        // Worth saying out loud: the preview above is the oriented picture, but
        // the upload judges the stored pixels, so the two can disagree about
        // which way round this photo is.
        <p className="text-xs text-muted-foreground">
          This file carries a rotation tag. It is shown here the way it will be
          displayed, but the upload checks its stored shape, so the result may
          differ from what you see.
        </p>
      ) : null}
    </div>
  );
}
