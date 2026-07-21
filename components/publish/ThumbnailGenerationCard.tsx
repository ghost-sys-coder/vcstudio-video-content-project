"use client";

import { DownloadIcon, RefreshCwIcon, StarIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ThumbnailView } from "@/lib/thumbnails/thumbnail-view";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ThumbnailGenerationCard({
  projectId,
  thumbnail,
  canManage,
  busy,
  onToggleFavorite,
  onRegenerate,
  onDismiss,
}: {
  projectId: string;
  thumbnail: ThumbnailView;
  canManage: boolean;
  busy: boolean;
  onToggleFavorite: (thumbnailId: string, isFavorite: boolean) => void;
  onRegenerate: (thumbnailId: string) => void;
  onDismiss: (thumbnailId: string) => void;
}) {
  const assetUrl = `/api/projects/${projectId}/thumbnails/${thumbnail.id}/asset`;
  const isActive =
    thumbnail.status === "pending" ||
    thumbnail.status === "queued" ||
    thumbnail.status === "running";
  const isDead =
    thumbnail.status === "failed" || thumbnail.status === "cancelled";
  const modeLabel =
    thumbnail.textMode === "baked" ? "Headline baked in" : "Text-free";

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border bg-background">
      <div className="relative flex aspect-video items-center justify-center bg-muted">
        {thumbnail.status === "succeeded" && thumbnail.hasAsset ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed R2 redirect, not an optimizable static asset
          <img
            alt={
              thumbnail.headlineText
                ? `Thumbnail with headline: ${thumbnail.headlineText}`
                : "Generated thumbnail"
            }
            className="h-full w-full object-contain"
            src={assetUrl}
          />
        ) : (
          <p className="px-3 text-center text-xs text-muted-foreground">
            {isActive
              ? "Generating…"
              : thumbnail.status === "cancelled"
                ? "Cancelled"
                : (thumbnail.safeErrorMessage ?? "This thumbnail failed.")}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium">
            {thumbnail.headlineText ?? modeLabel}
          </p>
          {canManage ? (
            <Button
              aria-label={
                thumbnail.isFavorite
                  ? "Remove from favorites"
                  : "Add to favorites"
              }
              aria-pressed={thumbnail.isFavorite}
              className="size-8 shrink-0"
              onClick={() =>
                onToggleFavorite(thumbnail.id, !thumbnail.isFavorite)
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              <StarIcon
                aria-hidden
                className={
                  thumbnail.isFavorite
                    ? "size-4 fill-current text-amber-500"
                    : "size-4"
                }
              />
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>{modeLabel}</span>
          {thumbnail.width && thumbnail.height ? (
            <span>
              {thumbnail.width}×{thumbnail.height}
            </span>
          ) : null}
          <span>
            {formatCents(
              thumbnail.actualCostCents ?? thumbnail.estimatedCostCents,
            )}
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            {thumbnail.createdAtLabel}
          </span>
          <div className="flex items-center gap-2">
            {thumbnail.status === "succeeded" && thumbnail.hasAsset ? (
              <a
                className={buttonVariants({ size: "sm", variant: "outline" })}
                download
                href={assetUrl}
              >
                <DownloadIcon aria-hidden className="size-3.5" />
                Download
              </a>
            ) : null}
            {isDead && canManage ? (
              <>
                <Button
                  disabled={busy}
                  onClick={() => onDismiss(thumbnail.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Dismiss
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => onRegenerate(thumbnail.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCwIcon aria-hidden className="size-3.5" />
                  Regenerate
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
