"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelTitleGenerationAction,
  generateTitlesAction,
  loadTitlesViewAction,
  toggleTitleFavoriteAction,
} from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TitleSuggestionCard } from "@/components/publish/TitleSuggestionCard";
import { PUBLISHING_METADATA_UPDATED_EVENT } from "@/lib/publishing/generated-metadata";
import type { TitlesView } from "@/lib/titles/title-view";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function isActiveStatus(status: string): boolean {
  return status === "pending" || status === "queued" || status === "running";
}

function isCancellableStatus(status: string): boolean {
  return status === "pending" || status === "queued";
}

export function PlatformTitlesPanel({
  projectId,
  canGenerate,
  initialData,
}: {
  projectId: string;
  canGenerate: boolean;
  initialData: TitlesView;
}) {
  const [data, setData] = useState<TitlesView>(initialData);
  const [platform, setPlatform] = useState<string>(
    initialData.platforms[0]?.platform ?? "youtube",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef(false);

  const platformItems = useMemo(
    () =>
      Object.fromEntries(
        data.platforms.map((entry) => [entry.platform, entry.label]),
      ),
    [data.platforms],
  );

  const current = useMemo(
    () =>
      data.platforms.find((entry) => entry.platform === platform) ??
      data.platforms[0] ??
      null,
    [data.platforms, platform],
  );

  const generating = Boolean(
    current?.latestRun && isActiveStatus(current.latestRun.status),
  );
  const cancellable = Boolean(
    current?.latestRun && isCancellableStatus(current.latestRun.status),
  );

  const refresh = useCallback(async () => {
    const view = await loadTitlesViewAction(projectId);
    if (view) setData(view);
    return view;
  }, [projectId]);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const view = await refresh();
        const entry = view?.platforms.find(
          (item) => item.platform === platform,
        );
        if (entry?.latestRun && !isActiveStatus(entry.latestRun.status)) {
          if (entry.latestRun.status === "completed")
            window.dispatchEvent(
              new CustomEvent(PUBLISHING_METADATA_UPDATED_EVENT, {
                detail: { projectId },
              }),
            );
          return;
        }
      }
    } finally {
      pollingRef.current = false;
    }
  }, [platform, projectId, refresh]);

  useEffect(() => {
    if (generating) void poll();
  }, [generating, poll]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("platform", platform);
      formData.set("optionCount", String(data.optionCount));
      formData.set("requestNonce", crypto.randomUUID());
      const result = await generateTitlesAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!current?.latestRun) return;
    const runId = current.latestRun.id;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("titleGenerationRunId", runId);
      const result = await cancelTitleGenerationAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(suggestionId: string, isFavorite: boolean) {
    // Optimistically flip, then reconcile from the server.
    setData((previous) => ({
      ...previous,
      platforms: previous.platforms.map((entry) =>
        entry.platform !== platform
          ? entry
          : {
              ...entry,
              suggestions: entry.suggestions.map((suggestion) =>
                suggestion.id === suggestionId
                  ? { ...suggestion, isFavorite }
                  : suggestion,
              ),
            },
      ),
    }));
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("suggestionId", suggestionId);
    formData.set("isFavorite", String(isFavorite));
    const result = await toggleTitleFavoriteAction(formData);
    if (!result.success) {
      setError(result.error);
      await refresh();
    } else {
      window.dispatchEvent(
        new CustomEvent(PUBLISHING_METADATA_UPDATED_EVENT, {
          detail: { projectId },
        }),
      );
    }
  }

  const run = current?.latestRun ?? null;
  const failedNotCancelled =
    run?.status === "failed" && run.errorCategory !== "cancelled";
  const cancelledRun =
    run?.status === "failed" && run.errorCategory === "cancelled";

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Publishing metadata</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate ranked titles, a publication-ready description or caption,
          and relevant tags from your brief and approved script. Selecting a
          connected channel below loads the latest set as editable drafts.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="title-platform-select">
            Platform
          </Label>
          <Select
            items={platformItems}
            onValueChange={(value) => {
              setError(null);
              setPlatform(String(value));
            }}
            value={platform}
          >
            <SelectTrigger className="min-w-48" id="title-platform-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.platforms.map((entry) => (
                <SelectItem key={entry.platform} value={entry.platform}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canGenerate ? (
          <Button
            disabled={busy || generating || !data.hasContext}
            onClick={generate}
            type="button"
          >
            {generating
              ? "Generating…"
              : busy
                ? "Starting…"
                : `Generate metadata (~${formatCents(current?.estimatedCostCents ?? 0)})`}
          </Button>
        ) : null}

        {generating && cancellable && canGenerate ? (
          <Button
            disabled={busy}
            onClick={cancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {!data.hasContext ? (
        <p className="text-xs text-muted-foreground">
          Add a topic to the brief or approve a script to enable title
          generation.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {generating ? (
        <p className="text-sm text-muted-foreground" role="status">
          Generating {current?.label} publishing metadata… this usually takes a
          few seconds.
        </p>
      ) : null}
      {failedNotCancelled ? (
        <p className="text-sm text-destructive">
          {run?.safeErrorMessage ??
            "The last metadata generation failed. Try again."}
        </p>
      ) : null}
      {cancelledRun ? (
        <p className="text-sm text-muted-foreground">
          {run?.safeErrorMessage ?? "Title generation was cancelled."}
        </p>
      ) : null}

      {current && current.suggestions.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {current.suggestions.map((suggestion) => (
            <TitleSuggestionCard
              canManage={canGenerate}
              key={suggestion.id}
              onToggleFavorite={toggleFavorite}
              suggestion={suggestion}
            />
          ))}
        </ul>
      ) : !generating ? (
        <p className="text-sm text-muted-foreground">
          No {current?.label} publishing metadata yet. Generate a set to get
          started.
        </p>
      ) : null}
    </section>
  );
}
