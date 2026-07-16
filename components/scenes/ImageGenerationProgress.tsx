"use client";

import { useEffect, useState } from "react";
import type { SceneImageGenerationStatus } from "@/lib/scenes/scene-image-view";
import { Badge } from "@/components/ui/badge";

export function ImageGenerationProgress({
  generationId,
  status,
  progressPercent,
  generationVersion,
  onPoll,
  pollIntervalMilliseconds = 4000,
}: {
  generationId: string;
  status: SceneImageGenerationStatus;
  progressPercent: number;
  generationVersion: number;
  onPoll?: (generationId: string) => Promise<void>;
  pollIntervalMilliseconds?: number;
}) {
  const [pollingError, setPollingError] = useState<string | null>(null);
  const active =
    status === "pending" || status === "queued" || status === "running";

  useEffect(() => {
    if (!active || !onPoll) return;

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        await onPoll(generationId);
        if (!cancelled) setPollingError(null);
      } catch {
        if (!cancelled) {
          setPollingError(
            "Progress could not be refreshed. The generation may still be running.",
          );
        }
      }

      if (!cancelled) {
        timer = window.setTimeout(poll, pollIntervalMilliseconds);
      }
    };

    timer = window.setTimeout(poll, pollIntervalMilliseconds);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [active, generationId, onPoll, pollIntervalMilliseconds]);

  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className="rounded-xl border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Generation v{generationVersion}</p>
        <Badge className="capitalize" variant="secondary">
          {status}
        </Badge>
      </div>
      <div
        aria-label={`Image generation ${progressPercent}% complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPercent}
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {progressPercent}% complete. You can keep reviewing the scene while the
        background task runs.
      </p>
      {pollingError ? (
        <p
          className="mt-2 text-xs text-amber-700 dark:text-amber-300"
          role="alert"
        >
          {pollingError}
        </p>
      ) : null}
    </section>
  );
}
