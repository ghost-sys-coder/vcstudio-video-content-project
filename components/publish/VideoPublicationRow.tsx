"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicationView } from "@/lib/publishing/publishing-view";

const statusLabels: Record<PublicationView["status"], string> = {
  pending: "Preparing",
  queued: "Queued",
  uploading: "Uploading",
  processing: "Processing",
  succeeded: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function VideoPublicationRow({
  publication,
  canManage,
  busy,
  onCancel,
}: {
  publication: PublicationView;
  canManage: boolean;
  busy: boolean;
  onCancel: (publicationId: string) => void;
}) {
  const isUploading =
    publication.status === "uploading" || publication.status === "processing";
  const cancellable = publication.status === "queued";
  const statusLabel =
    publication.platform === "tiktok" &&
    publication.status === "succeeded" &&
    publication.providerOperationStage === "inbox_delivered"
      ? "Delivered to inbox"
      : statusLabels[publication.status];

  return (
    <li className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{publication.title}</p>
          <p className="text-xs text-muted-foreground">
            {publication.platformLabel}
            {publication.platform === "tiktok"
              ? " · Creator completes posting in TikTok"
              : ` · ${publication.visibility}`}{" "}
            · {publication.createdAtLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
          {statusLabel}
        </span>
      </div>

      {isUploading ? (
        <div
          aria-label="Upload progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={publication.progressPercent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-foreground/70 transition-[width]"
            style={{ width: `${publication.progressPercent}%` }}
          />
        </div>
      ) : null}

      {publication.safeErrorMessage &&
      publication.status !== "succeeded" &&
      publication.status !== "cancelled" ? (
        <p className="text-xs text-destructive">
          {publication.safeErrorMessage}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        {publication.externalVideoUrl ? (
          <a
            className="inline-flex items-center gap-1.5 text-xs underline underline-offset-2"
            href={publication.externalVideoUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            <ExternalLinkIcon aria-hidden className="size-3.5" />
            {publication.platform === "tiktok" &&
            publication.providerOperationStage === "inbox_delivered"
              ? "Open TikTok"
              : `View on ${publication.platformLabel}`}
          </a>
        ) : null}
        {canManage && cancellable ? (
          <Button
            disabled={busy}
            onClick={() => onCancel(publication.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </li>
  );
}
