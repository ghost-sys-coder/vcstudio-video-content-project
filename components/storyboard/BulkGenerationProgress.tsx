"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatUsdCents } from "@/lib/format/currency";
import type {
  BulkSceneImageActionResult,
  StoryboardBatchView,
} from "@/lib/scenes/storyboard-view";
import type { SceneImageBatchDisplayStatus } from "@/lib/domain/bulk-scene-image";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<SceneImageBatchDisplayStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  completedWithErrors: "Completed with errors",
  cancelled: "Cancelled",
};

export function BulkGenerationProgress({
  batch,
  canCancel,
  onCancel,
}: {
  batch: StoryboardBatchView;
  canCancel: boolean;
  onCancel: () => Promise<BulkSceneImageActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { counts } = batch;
  const terminal = counts.succeeded + counts.failed + counts.cancelled;
  const percent =
    counts.total > 0 ? Math.round((terminal / counts.total) * 100) : 0;
  const isProcessing = batch.displayStatus === "processing";

  return (
    <section
      aria-label="Batch generation progress"
      className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
              batch.displayStatus === "completed" &&
                "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
              batch.displayStatus === "completedWithErrors" &&
                "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300",
              batch.displayStatus === "cancelled" &&
                "bg-muted text-muted-foreground ring-foreground/15",
              (batch.displayStatus === "processing" ||
                batch.displayStatus === "pending") &&
                "bg-primary/10 text-primary ring-primary/20",
            )}
          >
            {STATUS_LABELS[batch.displayStatus]}
          </span>
          <span className="text-xs text-muted-foreground">
            Started {batch.createdAtLabel}
          </span>
        </div>
        {canCancel && isProcessing ? (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await onCancel();
                if (!result.success) setError(result.error);
              })
            }
            size="sm"
            type="button"
            variant="destructive"
          >
            {pending ? "Cancelling…" : "Cancel queued"}
          </Button>
        ) : null}
      </div>

      <div
        aria-hidden
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
        {(
          [
            ["Total", counts.total],
            ["Queued", counts.queued + counts.pending],
            ["Running", counts.running],
            ["Succeeded", counts.succeeded],
            ["Failed", counts.failed],
            ["Cancelled", counts.cancelled],
          ] as const
        ).map(([label, value]) => (
          <div
            className="rounded-lg bg-muted/40 py-2 ring-1 ring-inset ring-foreground/10"
            key={label}
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-muted-foreground">
        Estimated {formatUsdCents(batch.estimatedCostCents)} · Actual{" "}
        {formatUsdCents(batch.actualCostCents)}
      </p>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
