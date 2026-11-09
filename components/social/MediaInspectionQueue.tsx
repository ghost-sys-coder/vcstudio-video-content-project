"use client";
import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { formatBytes } from "@/lib/format/bytes";

export function MediaInspectionQueue({
  items,
  error,
  busyId,
  onCheck,
  onRetry,
}: {
  items: MediaAssetView[];
  error: string | null;
  busyId: string | null;
  onCheck: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
}) {
  if (!items.length && !error) return null;
  return (
    <section aria-label="Upload verification" className="app-section">
      <div className="app-heading">
        <h2 className="text-lg font-semibold">Upload verification</h2>
        <p className="text-sm text-muted-foreground">
          Your originals are saved. Ready videos appear below automatically
          during active checks; no thumbnail is required. Checks pause after two
          minutes and while this tab is hidden.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="app-grid grid-cols-1 md:grid-cols-2">
        {items.map((asset) => (
          <li
            key={asset.id}
            className="app-panel min-w-0 rounded-xl border bg-card"
          >
            <div className="app-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-all font-medium">{asset.title}</p>
                <Badge
                  variant={asset.inspectionFailed ? "destructive" : "secondary"}
                >
                  {asset.inspectionFailed
                    ? "Verification failed"
                    : "Verifying video"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatBytes(asset.sizeBytes)}
              </p>
              <p role="status" className="text-sm text-muted-foreground">
                {asset.inspectionFailed
                  ? asset.inspectionError ||
                    "Verification stopped. Retry using the saved original; no upload is needed."
                  : "Checking video format and metadata. It will become selectable once this finishes."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyId !== null}
                  onClick={() => void onCheck(asset.id)}
                >
                  {busyId === asset.id ? (
                    <Loader2Icon aria-hidden className="animate-spin" />
                  ) : null}
                  Check status
                </Button>
                {asset.inspectionFailed ? (
                  <Button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void onRetry(asset.id)}
                  >
                    Retry verification
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
