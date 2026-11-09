"use client";

import { Loader2Icon } from "lucide-react";
import { Progress } from "@/components/ui/Progress";
import { formatBytes } from "@/lib/format/bytes";
import type { ActiveMediaUpload } from "@/hooks/useMediaUploadQueue";

const PHASE_LABELS = {
  preparing: "Preparing file",
  uploading: "Uploading file",
  finalizing: "Finishing file",
};

export function MediaUploadProgress({ upload }: { upload: ActiveMediaUpload }) {
  const { progress } = upload;
  const preparing = progress.phase === "preparing";
  const finalizing = progress.phase === "finalizing";
  const percentage =
    progress.totalBytes > 0
      ? Math.floor((progress.uploadedBytes / progress.totalBytes) * 100)
      : 0;

  return (
    <section
      aria-label="File upload progress"
      className="w-full min-w-0 space-y-3 rounded-xl border bg-background/80 p-4 text-left"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p role="status" className="flex items-center gap-2 font-medium">
          <Loader2Icon
            aria-hidden
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
          />
          {PHASE_LABELS[progress.phase]} {upload.fileIndex} of{" "}
          {upload.fileCount}
        </p>
        <span className="text-muted-foreground tabular-nums">
          {preparing
            ? "Preparing…"
            : finalizing
              ? "100% transferred"
              : `${percentage}%`}
        </span>
      </div>
      <p className="break-all text-sm font-medium">{upload.fileName}</p>
      <Progress
        aria-label={`Upload progress for ${upload.fileName}`}
        getAriaValueText={() =>
          preparing
            ? "Preparing upload"
            : finalizing
              ? "File transferred; finishing upload"
              : `${percentage}% transferred`
        }
        value={preparing ? null : percentage}
        className={
          preparing
            ? "motion-safe:animate-pulse [&_[data-slot=progress-indicator]]:w-1/3"
            : undefined
        }
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatBytes(progress.uploadedBytes)} of{" "}
        {formatBytes(progress.totalBytes)}
      </p>
      <p className="text-xs text-muted-foreground">
        {finalizing
          ? "Saving your file. Videos are verified before they can be used."
          : "Keep this page open until the upload finishes."}
      </p>
    </section>
  );
}
