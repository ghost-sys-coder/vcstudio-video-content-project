"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ReframeCancelDialog } from "@/components/render/ReframeCancelDialog";
import { ReframeConfirmDialog } from "@/components/render/ReframeConfirmDialog";
import {
  cancelReframeAction,
  planReframeAction,
  startReframeAction,
} from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import {
  describeReframeConfirmation,
  type ReframePlanSummary,
} from "@/lib/reframe/reframe-confirmation";
import type { ReframeTargetView } from "@/lib/reframe/reframe-job-view";

/**
 * One shape this video can be reframed into, and the state of the last attempt.
 *
 * Clicking asks the server what it would do, then puts that answer in a dialog
 * that has to be accepted before anything is spent. The plan is fetched first
 * rather than guessed in the browser so the confirmation states what will
 * actually happen, not an approximation of it.
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
  const [summary, setSummary] = useState<ReframePlanSummary | null>(null);
  const [costCents, setCostCents] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
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
        setSummary(null);
        return;
      }
      setSummary(result.plan);
      setCostCents(result.estimatedCostCents);
      setConfirmOpen(true);
    });
  }

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startReframeAction(form());
      if (!result.success) {
        setError(result.error);
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      setSummary(null);
      router.refresh();
    });
  }

  function cancel() {
    const job = target.job;
    if (!job) return;
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("jobId", job.id);
      const result = await cancelReframeAction(data);
      if (!result.success) {
        setError(result.error);
        setCancelOpen(false);
        return;
      }
      setCancelOpen(false);
      router.refresh();
    });
  }

  const job = target.job;
  const running = job?.active === true;
  const confirmation = summary
    ? describeReframeConfirmation({
        summary,
        aspectRatio: target.aspectRatio,
        estimatedCostCents: costCents,
      })
    : null;

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
              onClick={() => setCancelOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          ) : (
            <Button
              disabled={pending}
              onClick={requestPlan}
              size="sm"
              type="button"
            >
              {pending ? "Checking…" : `Reframe to ${target.aspectRatio}`}
            </Button>
          )
        ) : null}
      </div>

      {job ? (
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{job.progress.label}</span>
            {job.progress.detail ? (
              <span className="text-muted-foreground">
                {job.progress.detail}
              </span>
            ) : null}
          </div>
          {running ? (
            <ProgressBar
              label={`${job.progress.label} for ${target.aspectRatio}`}
              percent={job.progress.percent}
            />
          ) : null}
          {running ? (
            <p className="text-muted-foreground">
              This continues without you. You can leave this page.
            </p>
          ) : null}
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

      {confirmation ? (
        <ReframeConfirmDialog
          confirmation={confirmation}
          onConfirm={start}
          onOpenChange={setConfirmOpen}
          open={confirmOpen}
          pending={pending}
        />
      ) : null}

      {running && job ? (
        <ReframeCancelDialog
          onConfirm={cancel}
          onOpenChange={setCancelOpen}
          open={cancelOpen}
          pending={pending}
          status={job.status === "rendering" ? "rendering" : "extending"}
        />
      ) : null}
    </li>
  );
}
