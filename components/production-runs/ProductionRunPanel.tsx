"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelProductionRunAction,
  resumeProductionRunAction,
} from "@/app/(authenticated)/app/projects/[projectId]/actions";
import { ProductionRunEventList } from "@/components/production-runs/ProductionRunEventList";
import { ProductionRunGateSummary } from "@/components/production-runs/ProductionRunGateSummary";
import { ProductionRunStageList } from "@/components/production-runs/ProductionRunStageList";
import { ProductionRunStatusBadge } from "@/components/production-runs/ProductionRunStatusBadge";
import {
  StartProductionRunDialog,
  type VoicePresetOption,
} from "@/components/production-runs/StartProductionRunDialog";
import { Button } from "@/components/ui/button";
import type { ProductionRunPanelView } from "@/lib/production-runs/production-run-view";
import { formatCents } from "@/lib/production-runs/run-budget";

const POLL_MILLISECONDS = 8_000;

/**
 * The project's unattended production, if any, and the control to start one.
 *
 * Polls only while a run is queued or running and stops the moment it is not;
 * a held or finished run changes only when a person acts on it.
 */
export function ProductionRunPanel({
  canRun,
  panel: initialPanel,
  projectBudgetCents,
  projectId,
  voicePresets,
}: {
  canRun: boolean;
  panel: ProductionRunPanelView;
  projectBudgetCents: number;
  projectId: string;
  voicePresets: VoicePresetOption[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState(initialPanel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = panel.run;
  const active = run?.active === true;

  // A server refresh after an action replaces the polled state; adjusting
  // during render avoids an extra effect-driven pass.
  const [seenInitial, setSeenInitial] = useState(initialPanel);
  if (seenInitial !== initialPanel) {
    setSeenInitial(initialPanel);
    setPanel(initialPanel);
  }

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/production-run`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled && body?.success) setPanel(body.panel);
      } catch {
        // The next poll recovers; the panel keeps the last state it knew.
      }
    }, POLL_MILLISECONDS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, projectId]);

  function mutate(action: typeof cancelProductionRunAction, runId: string) {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("runId", runId);
      const result = await action(data);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const canStart =
    canRun && panel.enabled && (!run || (!run.active && !run.canResume));

  return (
    <section
      aria-labelledby="production-run-heading"
      className="app-panel space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold" id="production-run-heading">
            Unattended production
          </h2>
          <p className="text-sm text-muted-foreground">
            Runs every stage with a check before each acceptance, then stops at
            the release package for you.
          </p>
        </div>
        {canStart ? (
          <StartProductionRunDialog
            defaultMaximumCostCents={panel.defaultMaximumCostCents}
            projectBudgetCents={projectBudgetCents}
            projectId={projectId}
            voicePresets={voicePresets}
          />
        ) : null}
      </div>

      {!panel.enabled ? (
        <p className="text-sm text-muted-foreground">
          Production runs are not enabled in this deployment.
        </p>
      ) : null}
      {!canRun ? (
        <p className="text-sm text-muted-foreground">
          Only owners and editors can run production.
        </p>
      ) : null}

      {run ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ProductionRunStatusBadge
              label={run.statusLabel}
              status={run.status}
            />
            <span className="text-sm">
              {run.status === "ready_for_review"
                ? "Release package ready"
                : `At ${run.stageLabel.toLowerCase()}`}
            </span>
            <span className="text-xs text-muted-foreground">
              Spent about {formatCents(run.spentCostCents)} of a{" "}
              {formatCents(run.maximumCostCents)} ceiling · {run.imageQuality}{" "}
              images
            </span>
            {canRun && run.canCancel ? (
              <Button
                disabled={pending}
                onClick={() => mutate(cancelProductionRunAction, run.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                Cancel run
              </Button>
            ) : null}
            {canRun && run.canResume && panel.enabled ? (
              <Button
                disabled={pending}
                onClick={() => mutate(resumeProductionRunAction, run.id)}
                size="sm"
                type="button"
              >
                Resume
              </Button>
            ) : null}
          </div>

          <ProductionRunStageList stages={run.stages} />

          {run.holdReason ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium">The run needs you.</p>
              <p className="mt-1">{run.holdReason}</p>
              <p className="mt-1 text-muted-foreground">
                Fix it in the stage named above, then resume. The run continues
                from exactly where it stopped.
              </p>
            </div>
          ) : null}
          {run.safeErrorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {run.safeErrorMessage}
            </p>
          ) : null}
          {run.status === "ready_for_review" ? (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
              <p className="font-medium">Your review is the last step.</p>
              <p className="mt-1">
                The title, description, tags and thumbnail are saved as a draft
                release package. Confirm it against the render, answer the
                platform declarations, and schedule it.
              </p>
              <Button
                className="mt-2"
                nativeButton={false}
                render={<Link href={`/app/projects/${projectId}/publish`} />}
                size="sm"
              >
                Open publish
              </Button>
            </div>
          ) : null}
          {active ? (
            <p className="text-xs text-muted-foreground">
              This continues without you. You can leave this page.
            </p>
          ) : null}

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium">
              Checks ({run.gates.length})
            </summary>
            <div className="mt-2">
              <ProductionRunGateSummary
                gates={run.gates}
                summary={run.gateSummary}
              />
            </div>
          </details>
          <details className="group" open={run.status !== "ready_for_review"}>
            <summary className="cursor-pointer text-sm font-medium">
              Activity ({run.events.length})
            </summary>
            <div className="mt-2">
              <ProductionRunEventList events={run.events} />
            </div>
          </details>
        </div>
      ) : panel.enabled && canRun ? (
        <p className="text-sm text-muted-foreground">
          No run yet. Start one to take this project from wherever it stands to
          a release package.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
