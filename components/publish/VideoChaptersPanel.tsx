"use client";

import { PlusIcon } from "lucide-react";
import { ChapterDescriptionPreview } from "@/components/publish/ChapterDescriptionPreview";
import { ChapterEditorRow } from "@/components/publish/ChapterEditorRow";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChaptersView } from "@/lib/chapters/chapters-view";
import { useVideoChapters } from "@/lib/chapters/use-video-chapters";
import { formatUsdCents } from "@/lib/format/currency";

/**
 * YouTube chapters for a finished render: generate them with AI, adjust them,
 * and choose whether they go into the YouTube description when publishing.
 */
export function VideoChaptersPanel({
  projectId,
  canEdit,
  initialData,
}: {
  projectId: string;
  canEdit: boolean;
  initialData: ChaptersView;
}) {
  const chapters = useVideoChapters({ projectId, initialData });
  const { view, selected, draft, issues, busy, generating } = chapters;
  const run = selected?.latestRun ?? null;
  const locked = !canEdit || busy || generating;
  const listIssues = issues.filter((issue) => issue.index === null);
  const blocksSave =
    draft.includeInYouTubeDescription &&
    (issues.length > 0 || chapters.offSceneIndexes.length > 0);
  const renderItems = Object.fromEntries(
    view.renders.map((render) => [render.id, render.label]),
  );

  return (
    <section
      aria-labelledby="video-chapters-heading"
      className="space-y-4 rounded-xl border bg-card p-4"
    >
      <div>
        <h2 className="text-sm font-semibold" id="video-chapters-heading">
          Video chapters
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Chapter timestamps for YouTube, picked by AI from a render&apos;s
          narration and placed exactly on its scene cuts. Review them here; when
          publishing to YouTube they are added to the end of the description.
        </p>
      </div>

      {view.renders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chapters are made from a finished render. Render the video first.
        </p>
      ) : (
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs" htmlFor="chapters-render-select">
            Render
          </Label>
          <Select
            disabled={busy || generating}
            items={renderItems}
            onValueChange={(value) => void chapters.selectRender(String(value))}
            value={selected?.renderId ?? null}
          >
            <SelectTrigger className="w-full" id="chapters-render-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {view.renders.map((render) => (
                <SelectItem key={render.id} value={render.id}>
                  {render.label}
                  {render.ineligibleReason ? " — no chapters" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selected?.ineligibleReason ? (
        <p className="text-sm text-muted-foreground">
          {selected.ineligibleReason}
        </p>
      ) : null}

      {selected && selected.estimatedCostCents !== null && canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || generating}
            onClick={() => void chapters.generate()}
            type="button"
          >
            {generating
              ? "Generating chapters…"
              : `${draft.chapters.length > 0 ? "Regenerate" : "Generate"} chapters (~${formatUsdCents(selected.estimatedCostCents)})`}
          </Button>
          {generating && chapters.cancellable ? (
            <Button
              disabled={busy}
              onClick={() => void chapters.cancel()}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          ) : null}
          {draft.chapters.length > 0 && !generating ? (
            <p className="text-xs text-muted-foreground">
              Regenerating replaces the chapters below, including edits.
            </p>
          ) : null}
        </div>
      ) : null}

      {selected && selected.scenesFromCurrentNarration > 0 ? (
        <p className="text-xs text-muted-foreground">
          This render was made without captions, so{" "}
          {selected.scenesFromCurrentNarration} scene
          {selected.scenesFromCurrentNarration === 1 ? "" : "s"} will be
          described from current narration, which may have changed since. Times
          still come from the render.
        </p>
      ) : null}

      {generating ? (
        <p className="text-sm text-muted-foreground" role="status">
          Choosing chapters… this usually takes a few seconds.
        </p>
      ) : null}
      {run?.status === "failed" ? (
        <p
          className={
            run.errorCategory === "cancelled"
              ? "text-sm text-muted-foreground"
              : "text-sm text-destructive"
          }
          role={run.errorCategory === "cancelled" ? "status" : "alert"}
        >
          {run.safeErrorMessage ?? "The last chapter generation failed."}
        </p>
      ) : null}

      {selected && draft.chapters.length > 0 ? (
        <div className="space-y-3">
          {listIssues.length > 0 ? (
            <ul className="space-y-1 text-sm text-destructive" role="alert">
              {listIssues.map((issue) => (
                <li key={issue.message}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          <ol className="space-y-2" aria-label="Chapters">
            {draft.chapters.map((chapter, index) => (
              <ChapterEditorRow
                chapter={chapter}
                disabled={locked}
                index={index}
                key={`${index}-${chapter.startMilliseconds}`}
                messages={[
                  ...(chapters.offSceneIndexes.includes(index)
                    ? ["This time is not a scene start in this render."]
                    : []),
                  ...issues
                    .filter((issue) => issue.index === index)
                    .map((issue) => issue.message),
                ]}
                onRemove={() => chapters.removeChapter(index)}
                onStartChange={(start) => chapters.setStart(index, start)}
                onTitleChange={(title) => chapters.setTitle(index, title)}
                sceneStarts={selected.sceneStarts}
                videoDurationMilliseconds={selected.videoDurationMilliseconds}
              />
            ))}
          </ol>
        </div>
      ) : selected && !generating && selected.estimatedCostCents !== null ? (
        <p className="text-sm text-muted-foreground">
          No chapters for this render yet.
        </p>
      ) : null}

      {selected && canEdit && selected.estimatedCostCents !== null ? (
        <div className="space-y-3">
          <Button
            disabled={locked || selected.sceneStarts.length === 0}
            onClick={chapters.addChapter}
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon aria-hidden /> Add chapter
          </Button>

          {draft.chapters.length > 0 ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                checked={draft.includeInYouTubeDescription}
                className="mt-0.5"
                disabled={locked}
                onChange={(event) =>
                  chapters.setIncludeInYouTubeDescription(
                    event.currentTarget.checked,
                  )
                }
                type="checkbox"
              />
              <span>
                Add to YouTube description when publishing this render
              </span>
            </label>
          ) : null}

          {draft.includeInYouTubeDescription && chapters.preview !== "" ? (
            <ChapterDescriptionPreview block={chapters.preview} />
          ) : null}

          {draft.chapters.length > 0 || selected.saved ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={locked || !draft.dirty || blocksSave}
                onClick={() => void chapters.save()}
                type="button"
              >
                {busy ? "Saving…" : "Save chapters"}
              </Button>
              {draft.dirty && blocksSave ? (
                <p className="text-xs text-muted-foreground">
                  Fix the issues above to save, or turn off &quot;Add to YouTube
                  description&quot;.
                </p>
              ) : draft.dirty ? (
                <p className="text-xs text-muted-foreground">
                  Unsaved changes.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {chapters.error ? (
        <p className="text-sm text-destructive" role="alert">
          {chapters.error}
        </p>
      ) : null}
      {chapters.notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {chapters.notice}
        </p>
      ) : null}
    </section>
  );
}
