"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  cancelReframeAction,
  planReframeAction,
  startReframeAction,
} from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import { formatUsdCents } from "@/lib/format/currency";
import type { ReframeTargetView } from "@/lib/reframe/reframe-job-view";

type Plan = {
  sceneCount: number;
  extendCount: number;
  cropCount: number;
  readyCount: number;
  blockedSceneNumbers: number[];
  croppedSceneNumbers: number[];
};

/**
 * One shape this video can be reframed into, and the state of the last attempt.
 *
 * Clicking asks for the plan first and shows what it costs. Starting is a
 * second, separate click, because extending every still is a paid generation
 * per scene and a single-click spend is the thing this deliberately avoids.
 */
export function ReframeTargetRow({
  canStart,
  projectId,
  target,
}: {
  canStart: boolean;
  projectId: string;
  target: ReframeTargetView;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [costCents, setCostCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function form() {
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("outputVariantId", target.outputVariantId);
    return data;
  }

  function requestPlan() {
    setError(null);
    startTransition(async () => {
      const result = await planReframeAction(form());
      if (!result.success) {
        setError(result.error);
        setPlan(null);
        return;
      }
      setPlan(result.plan);
      setCostCents(result.estimatedCostCents);
    });
  }

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startReframeAction(form());
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPlan(null);
      router.refresh();
    });
  }

  function cancel() {
    if (!target.job) return;
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("jobId", target.job!.id);
      const result = await cancelReframeAction(data);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const job = target.job;
  const running = job?.active === true;

  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {target.name} · {target.aspectRatio}
          </p>
          <p className="text-xs text-muted-foreground">
            {target.width} by {target.height}
          </p>
        </div>

        {canStart ? (
          running ? (
            <Button
              disabled={pending}
              onClick={cancel}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          ) : plan ? (
            <div className="flex items-center gap-2">
              <Button
                disabled={pending || plan.blockedSceneNumbers.length > 0}
                onClick={start}
                size="sm"
                type="button"
              >
                {pending ? "Starting..." : "Start reframe"}
              </Button>
              <Button
                disabled={pending}
                onClick={() => setPlan(null)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Back
              </Button>
            </div>
          ) : (
            <Button
              disabled={pending}
              onClick={requestPlan}
              size="sm"
              type="button"
            >
              {pending ? "Checking..." : `Reframe to ${target.aspectRatio}`}
            </Button>
          )
        ) : null}
      </div>

      {plan && !running ? (
        <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
          <p>
            <span className="font-medium">{plan.extendCount}</span> of{" "}
            {plan.sceneCount} scenes will be extended onto the taller canvas so
            nothing is cut off.
          </p>
          {plan.readyCount > 0 ? (
            <p className="text-muted-foreground">
              {plan.readyCount} already have an image in this shape and cost
              nothing.
            </p>
          ) : null}
          {plan.croppedSceneNumbers.length > 0 ? (
            <p className="text-amber-700 dark:text-amber-400">
              Scenes {plan.croppedSceneNumbers.join(", ")} were uploaded rather
              than generated, so they cannot be extended. They will be cropped.
            </p>
          ) : null}
          {plan.blockedSceneNumbers.length > 0 ? (
            <p className="text-destructive">
              Approve an image for scenes {plan.blockedSceneNumbers.join(", ")}{" "}
              first.
            </p>
          ) : null}
          <p className="font-medium">
            Estimated cost {formatUsdCents(costCents ?? 0)}.
          </p>
          <p className="text-muted-foreground">
            Extending runs first, then the vertical video renders on its own.
            You can leave this page.
          </p>
        </div>
      ) : null}

      {job ? (
        <div className="mt-3 space-y-1 text-xs">
          <p>
            <span className="font-medium">{job.statusLabel}</span>
            {running ? " — you can leave this page." : ""}
          </p>
          {job.croppedSceneNumbers.length > 0 ? (
            <p className="text-amber-700 dark:text-amber-400">
              Cropped rather than extended: scenes{" "}
              {job.croppedSceneNumbers.join(", ")}.
            </p>
          ) : null}
          {job.safeErrorMessage ? (
            <p className="text-destructive">{job.safeErrorMessage}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
