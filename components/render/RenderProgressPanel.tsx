"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { RenderStatusBadge } from "@/components/render/RenderStatusBadge";
import { Button } from "@/components/ui/button";
import type {
  RenderActionResult,
  RenderExportView,
} from "@/lib/render/render-view";

export function RenderProgressPanel({
  render,
  onCancel,
}: {
  render: RenderExportView;
  onCancel: (renderId: string) => Promise<RenderActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A render can be cancelled at any pre-terminal stage, including while it is
  // running: renders can stall mid-flight, so the reserved budget and worker
  // must be reclaimable without waiting for the reservation to expire.
  const cancellable =
    render.status === "pending" ||
    render.status === "queued" ||
    render.status === "running";
  const cancelLabel = render.status === "running" ? "Cancel render" : "Cancel";

  return (
    <section
      aria-label="Active render"
      className="space-y-3 rounded-xl border bg-muted/30 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2Icon
            aria-hidden
            className="size-4 animate-spin text-muted-foreground"
          />
          <h2 className="text-sm font-semibold">Rendering in progress</h2>
          <RenderStatusBadge status={render.status} />
        </div>
        {cancellable ? (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await onCancel(render.id);
                if (!result.success) setError(result.error);
              })
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            {pending ? "Cancelling…" : cancelLabel}
          </Button>
        ) : null}
      </div>

      <div
        aria-label="Render progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={render.progressPercent}
        className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${render.progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {render.progressPercent}% complete
      </p>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
