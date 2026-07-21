"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelThumbnailGenerationAction,
  generateThumbnailAction,
  loadThumbnailsViewAction,
  toggleThumbnailFavoriteAction,
} from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { ThumbnailGenerationCard } from "@/components/publish/ThumbnailGenerationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_THUMBNAIL_HEADLINE_LENGTH } from "@/lib/schemas/thumbnail";
import type { ThumbnailsView } from "@/lib/thumbnails/thumbnail-view";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function isActiveStatus(status: string): boolean {
  return status === "pending" || status === "queued" || status === "running";
}

const textModeItems = {
  clean: "Text-free (overlay later)",
  baked: "Headline baked in",
};

export function PlatformThumbnailsPanel({
  projectId,
  canGenerate,
  initialData,
}: {
  projectId: string;
  canGenerate: boolean;
  initialData: ThumbnailsView;
}) {
  const [data, setData] = useState<ThumbnailsView>(initialData);
  const [platform, setPlatform] = useState<string>(
    initialData.platforms[0]?.platform ?? "youtube",
  );
  const [textMode, setTextMode] = useState<string>("clean");
  const [headline, setHeadline] = useState("");
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

  const active = useMemo(
    () =>
      current?.thumbnails.find((thumbnail) =>
        isActiveStatus(thumbnail.status),
      ) ?? null,
    [current],
  );
  const generating = active !== null;
  const cancellable =
    active !== null &&
    (active.status === "pending" || active.status === "queued");

  const refresh = useCallback(async () => {
    const view = await loadThumbnailsViewAction(projectId);
    if (view) setData(view);
    return view;
  }, [projectId]);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const view = await refresh();
        const entry = view?.platforms.find(
          (item) => item.platform === platform,
        );
        if (
          entry &&
          !entry.thumbnails.some((thumbnail) =>
            isActiveStatus(thumbnail.status),
          )
        )
          return;
      }
    } finally {
      pollingRef.current = false;
    }
  }, [platform, refresh]);

  useEffect(() => {
    if (generating) void poll();
  }, [generating, poll]);

  const headlineRequired = textMode === "baked";
  const headlineMissing = headlineRequired && headline.trim() === "";

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("platform", platform);
      formData.set("textMode", textMode);
      formData.set("headlineText", headlineRequired ? headline.trim() : "");
      formData.set("requestNonce", crypto.randomUUID());
      const result = await generateThumbnailAction(formData);
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
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("thumbnailGenerationId", active.id);
      const result = await cancelThumbnailGenerationAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(thumbnailId: string, isFavorite: boolean) {
    // Optimistically flip, then reconcile from the server.
    setData((previous) => ({
      ...previous,
      platforms: previous.platforms.map((entry) =>
        entry.platform !== platform
          ? entry
          : {
              ...entry,
              thumbnails: entry.thumbnails.map((thumbnail) =>
                thumbnail.id === thumbnailId
                  ? { ...thumbnail, isFavorite }
                  : thumbnail,
              ),
            },
      ),
    }));
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("thumbnailGenerationId", thumbnailId);
    formData.set("isFavorite", String(isFavorite));
    const result = await toggleThumbnailFavoriteAction(formData);
    if (!result.success) {
      setError(result.error);
      await refresh();
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Platform thumbnails</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate cover images sized for each platform from your brief and
          approved script. These follow proven composition patterns — one clear
          face, strong emotion, high contrast — so they are solid candidates to
          A/B test, not guaranteed performers.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="thumbnail-platform-select">
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
            <SelectTrigger className="min-w-44" id="thumbnail-platform-select">
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

        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="thumbnail-text-mode-select">
            Text
          </Label>
          <Select
            items={textModeItems}
            onValueChange={(value) => {
              setError(null);
              setTextMode(String(value));
            }}
            value={textMode}
          >
            <SelectTrigger className="min-w-52" id="thumbnail-text-mode-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clean">Text-free (overlay later)</SelectItem>
              <SelectItem value="baked">Headline baked in</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {headlineRequired ? (
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="thumbnail-headline">
              Headline
            </Label>
            <Input
              className="min-w-56"
              id="thumbnail-headline"
              maxLength={MAX_THUMBNAIL_HEADLINE_LENGTH}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="2–4 punchy words"
              value={headline}
            />
          </div>
        ) : null}

        {canGenerate ? (
          <Button
            disabled={
              busy ||
              generating ||
              !data.hasContext ||
              !data.generationEnabled ||
              headlineMissing
            }
            onClick={generate}
            type="button"
          >
            {generating
              ? "Generating…"
              : busy
                ? "Starting…"
                : `Generate thumbnail (~${formatCents(current?.estimatedCostCents ?? 0)})`}
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

      {!data.generationEnabled ? (
        <p className="text-xs text-muted-foreground">
          Image generation is currently disabled.
        </p>
      ) : null}
      {!data.hasContext ? (
        <p className="text-xs text-muted-foreground">
          Add a topic to the brief or approve a script to enable thumbnail
          generation.
        </p>
      ) : null}
      {headlineMissing ? (
        <p className="text-xs text-muted-foreground">
          Add a headline, or switch to a text-free thumbnail.
        </p>
      ) : null}
      {textMode === "baked" ? (
        <p className="text-xs text-muted-foreground">
          Image models still render text imperfectly. Check the spelling on the
          result, or generate text-free and overlay the headline yourself.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {generating ? (
        <p className="text-sm text-muted-foreground" role="status">
          Generating a {current?.label} thumbnail… this usually takes under a
          minute.
        </p>
      ) : null}

      {current && current.thumbnails.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {current.thumbnails.map((thumbnail) => (
            <ThumbnailGenerationCard
              canManage={canGenerate}
              key={thumbnail.id}
              onToggleFavorite={toggleFavorite}
              projectId={projectId}
              thumbnail={thumbnail}
            />
          ))}
        </ul>
      ) : !generating ? (
        <p className="text-sm text-muted-foreground">
          No {current?.label} thumbnails yet. Generate one to get started.
        </p>
      ) : null}
    </section>
  );
}
