"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  cancelScriptGenerationAction,
  generateScriptAction,
  loadScriptGenerationViewAction,
} from "@/app/(authenticated)/app/projects/actions";
import type { ScriptGenerationRunView } from "@/lib/scripts/script-generation-view";
import { Button } from "@/components/ui/button";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function isActive(status: ScriptGenerationRunView["status"]): boolean {
  return status === "pending" || status === "queued" || status === "running";
}

function isCancellable(status: ScriptGenerationRunView["status"]): boolean {
  return status === "pending" || status === "queued";
}

export function GenerateScriptPanel({
  projectId,
  canEdit,
  model,
  estimatedCostCents,
  hasBriefTopic,
  requireHistoricalAccuracy,
  initialLatestRun,
}: {
  projectId: string;
  canEdit: boolean;
  model: string;
  estimatedCostCents: number;
  hasBriefTopic: boolean;
  requireHistoricalAccuracy: boolean;
  initialLatestRun: ScriptGenerationRunView | null;
}) {
  const [latestRun, setLatestRun] = useState(initialLatestRun);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cancelling, startCancelTransition] = useTransition();
  const pollingRef = useRef(false);

  const generating = latestRun !== null && isActive(latestRun.status);
  const cancellable = latestRun !== null && isCancellable(latestRun.status);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const view = await loadScriptGenerationViewAction(projectId);
        if (view?.latestRun) {
          setLatestRun(view.latestRun);
          if (!isActive(view.latestRun.status)) return;
        }
      }
    } finally {
      pollingRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    if (generating) void poll();
  }, [generating, poll]);

  function generate() {
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("requestNonce", crypto.randomUUID());
      const result = await generateScriptAction(data);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const view = await loadScriptGenerationViewAction(projectId);
      if (view?.latestRun) setLatestRun(view.latestRun);
    });
  }

  function cancel() {
    if (!latestRun) return;
    const runId = latestRun.id;
    startCancelTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("scriptGenerationRunId", runId);
      const result = await cancelScriptGenerationAction(data);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const view = await loadScriptGenerationViewAction(projectId);
      if (view?.latestRun) setLatestRun(view.latestRun);
    });
  }

  function insertIntoEditor() {
    if (!latestRun?.generatedContent) return;
    window.dispatchEvent(
      new CustomEvent("vcstudio:insert-script", {
        detail: latestRun.generatedContent,
      }),
    );
  }

  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Generate script with AI</h2>
          <p className="text-xs text-muted-foreground">
            Drafts a narration script from your brief using {model}. Review and
            edit before saving — these are AI suggestions, not guaranteed
            performers.
          </p>
          {requireHistoricalAccuracy ? (
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              Historical niche detected — factual-accuracy mode is on. The
              storyline will stick to verifiable events; still review before
              publishing.
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            disabled={pending || generating || !hasBriefTopic}
            onClick={generate}
            size="sm"
          >
            {generating
              ? "Generating…"
              : pending
                ? "Starting…"
                : `Generate script (~${formatCents(estimatedCostCents)})`}
          </Button>
        ) : null}
      </div>

      {!hasBriefTopic ? (
        <p className="text-xs text-muted-foreground">
          Add a topic to the brief above to enable script generation.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {generating ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" role="status">
            Generating your script… this usually takes a few seconds.
          </p>
          {canEdit && cancellable ? (
            <Button
              disabled={cancelling}
              onClick={cancel}
              size="sm"
              type="button"
              variant="outline"
            >
              {cancelling ? "Cancelling…" : "Cancel generation"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {latestRun &&
      latestRun.status === "failed" &&
      latestRun.errorCategory === "cancelled" ? (
        <p className="text-sm text-muted-foreground">
          {latestRun.safeErrorMessage ?? "Script generation was cancelled."}
        </p>
      ) : null}

      {latestRun &&
      latestRun.status === "failed" &&
      latestRun.errorCategory !== "cancelled" ? (
        <p className="text-sm text-destructive">
          {latestRun.safeErrorMessage ??
            "The last script generation failed. Try again."}
        </p>
      ) : null}

      {latestRun &&
      latestRun.status === "completed" &&
      latestRun.generatedContent ? (
        <div className="space-y-2">
          {latestRun.suggestedTitle ? (
            <p className="text-sm">
              <span className="font-medium">Suggested title:</span>{" "}
              {latestRun.suggestedTitle}
            </p>
          ) : null}
          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm leading-6">
            {latestRun.generatedContent}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button onClick={insertIntoEditor} size="sm" variant="outline">
                Insert into editor
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Generated {latestRun.createdAtLabel}
              {latestRun.actualCostCents !== null
                ? ` · ${formatCents(latestRun.actualCostCents)}`
                : ""}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
