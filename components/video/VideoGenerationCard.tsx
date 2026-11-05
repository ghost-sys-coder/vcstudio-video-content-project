"use client";
import Link from "next/link";
import { useState } from "react";
import { Play, LoaderCircle, RotateCw, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  videoResultAction,
  resumeVideoAction,
  cancelVideoAction,
} from "@/app/(authenticated)/app/video/actions";
import type { VideoGenerationView } from "@/lib/video-generation/video-generation-view";
import { videoMoney } from "@/lib/video-generation/video-composer-options";
const labels = {
  queued: "Queued",
  submitting: "Submitting",
  running: "Generating",
  inspecting: "Inspecting video",
  succeeded: "Ready",
  failed: "Failed",
  cancelled: "Cancelled",
  requires_reconciliation: "Needs attention",
};
export function VideoGenerationCard({
  workspaceId,
  job,
  canEdit,
  onChanged,
}: {
  workspaceId: string;
  job: VideoGenerationView;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function run(action: "preview" | "resume" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      if (action === "preview") {
        const result = await videoResultAction(workspaceId, job.id);
        if (!result.ok) setError(result.error);
        else if (result.value.url) setUrl(result.value.url);
        else setError("The video is not ready to preview.");
      } else {
        const result =
          action === "resume"
            ? await resumeVideoAction(workspaceId, job.id)
            : await cancelVideoAction(workspaceId, job.id);
        if (!result.ok) setError(result.error);
        else onChanged();
      }
    } catch {
      setError(
        "The request could not be completed. Refresh its existing status before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="space-y-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{job.title}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {job.model}
            </p>
          </div>
          <Badge
            variant={
              job.status === "requires_reconciliation" ||
              job.status === "failed"
                ? "destructive"
                : job.status === "succeeded"
                  ? "default"
                  : "secondary"
            }
          >
            {labels[job.status]}
          </Badge>
        </div>
        <div
          className={`flex items-center justify-center overflow-hidden rounded-2xl border bg-muted/35 ${job.status === "succeeded" ? "aspect-video" : "min-h-32"}`}
        >
          {url ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run("preview")}
            >
              {busy ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <RotateCw className="size-3" />
              )}
              Refresh preview link
            </Button>
          ) : null}
          {url ? (
            <video
              aria-label={job.title}
              src={url}
              controls
              preload="metadata"
              className="h-full w-full object-contain"
            />
          ) : job.status === "succeeded" ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run("preview")}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Preview video
            </Button>
          ) : (
            <div className="space-y-2 text-center text-muted-foreground">
              <Film className="mx-auto size-8 opacity-50" />
              <p className="text-xs">{labels[job.status]}</p>
            </div>
          )}
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {job.prompt}
        </p>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {job.resolution} · {job.aspectRatio} · {job.durationSeconds}s
            requested
          </span>
          <span className="tabular-nums">
            {job.actualCostCents === null
              ? `${videoMoney(job.estimatedCostCents)} reserved`
              : videoMoney(job.actualCostCents)}
          </span>
        </div>
        {job.safeErrorMessage ? (
          <p
            className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed"
            role={
              job.status === "failed" ||
              job.status === "requires_reconciliation"
                ? "alert"
                : undefined
            }
          >
            {job.safeErrorMessage}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {job.status === "succeeded" ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/app/social/library" />}
            >
              View in library
            </Button>
          ) : null}
          {job.target.kind === "scene" && !job.targetDetached ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  href={`/app/projects/${job.target.projectId}/scenes?sceneId=${job.target.sceneId}`}
                />
              }
            >
              Return to scene
            </Button>
          ) : null}
          {job.canResume && canEdit ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void run("resume")}
            >
              {busy ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <RotateCw className="size-3" />
              )}
              {job.status === "succeeded"
                ? "Refresh settled cost"
                : job.status === "queued"
                  ? "Dispatch request"
                  : "Resume existing job"}
            </Button>
          ) : null}
          {job.status === "queued" && canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run("cancel")}
            >
              Cancel queued video
            </Button>
          ) : null}
          {url ? (
            <a
              className="text-sm underline underline-offset-4"
              href={url}
              download
            >
              Download
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
