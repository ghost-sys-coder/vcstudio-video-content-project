"use client";

import { useState, useTransition } from "react";
import { AlertTriangleIcon } from "lucide-react";
import {
  confirmReleasePackageAction,
  saveReleasePackageAction,
} from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { ReleasePackagePreview } from "@/components/publish/ReleasePackagePreview";
import { ReleaseThumbnailChooser } from "@/components/publish/ReleaseThumbnailChooser";
import { ReleaseTitleChooser } from "@/components/publish/ReleaseTitleChooser";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseReleaseTags } from "@/lib/schemas/release-package";
import type { ReleasePackageView } from "@/lib/releases/release-package-view";
import type { ThumbnailView } from "@/lib/thumbnails/thumbnail-view";
import type { TitleSuggestionView } from "@/lib/titles/title-view";
import { cn } from "@/lib/utils";

/**
 * One destination's packaging form.
 *
 * The panel remounts this per destination, so the draft below always starts
 * from that destination's own stored copy and nothing can carry across. That
 * separation is the point of the slice, and a remount enforces it structurally
 * rather than relying on an effect to reset the fields.
 */
export function ReleasePackageEditor({
  projectId,
  entry,
  canEdit,
  titleSuggestions,
  thumbnails,
  onSaved,
}: {
  projectId: string;
  entry: ReleasePackageView;
  canEdit: boolean;
  titleSuggestions: TitleSuggestionView[];
  thumbnails: ThumbnailView[];
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(entry.title);
  const [titleSuggestionId, setTitleSuggestionId] = useState(
    entry.titleSuggestionId,
  );
  const [description, setDescription] = useState(entry.description);
  const [tags, setTags] = useState(entry.tags.join(", "));
  const [thumbnailGenerationId, setThumbnailGenerationId] = useState(
    entry.thumbnailGenerationId,
  );
  const [plannedReleaseDate, setPlannedReleaseDate] = useState(
    entry.plannedReleaseAtIso?.slice(0, 10) ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const disabled = !canEdit || pending;

  return (
    <div className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-4">
          <ReleaseTitleChooser
            disabled={disabled}
            onChange={(next) => {
              setTitle(next.title);
              setTitleSuggestionId(next.titleSuggestionId);
            }}
            suggestions={titleSuggestions}
            value={title}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="release-description">Description</Label>
              <CopyButton label="the description" value={description} />
            </div>
            <Textarea
              className="max-h-64 overflow-y-auto"
              disabled={disabled}
              id="release-description"
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              value={description}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="release-tags">Tags</Label>
              <CopyButton label="the tags" value={tags} />
            </div>
            <Input
              disabled={disabled}
              id="release-tags"
              onChange={(event) => setTags(event.target.value)}
              placeholder="Comma separated"
              value={tags}
            />
          </div>

          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <ReleaseThumbnailChooser
              disabled={disabled}
              onSelect={setThumbnailGenerationId}
              projectId={projectId}
              selectedId={thumbnailGenerationId}
              thumbnails={thumbnails}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs" htmlFor="release-planned">
              Intended release date
            </Label>
            <Input
              className="max-w-xs"
              disabled={disabled}
              id="release-planned"
              onChange={(event) => setPlannedReleaseDate(event.target.value)}
              type="date"
              value={plannedReleaseDate}
            />
            <p className="text-xs text-muted-foreground">
              Editorial intent only. Nothing is scheduled or published here.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">How it will look</p>
          <ReleasePackagePreview
            destinationLabel={entry.destinationLabel}
            platform={entry.platform}
            projectId={projectId}
            thumbnailAvailable={
              // An unsaved choice is known to exist because it came from the
              // gallery; only the saved one can have been deleted since.
              thumbnailGenerationId === entry.thumbnailGenerationId
                ? entry.thumbnailAvailable
                : true
            }
            thumbnailGenerationId={thumbnailGenerationId}
            title={title}
          />
        </div>
      </div>

      {entry.state.blockers.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-dashed p-3">
          {entry.state.blockers.map((blocker) => (
            <li
              className="flex items-start gap-2 text-xs text-muted-foreground"
              key={blocker.code}
            >
              <AlertTriangleIcon
                aria-hidden
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  entry.state.status === "stale"
                    ? "text-amber-600"
                    : "text-muted-foreground",
                )}
              />
              {blocker.message}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="text-xs text-muted-foreground" role="status">
          Saved.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setSaved(false);
              const result = await saveReleasePackageAction({
                projectId,
                outputVariantId: entry.outputVariantId,
                platform: entry.platform,
                channelProfileId: entry.channelProfileId,
                expectedRevision: entry.revision,
                title: title.trim(),
                titleSuggestionId,
                description,
                tags: parseReleaseTags(tags),
                visibility: entry.visibility,
                thumbnailGenerationId,
                caption: entry.caption,
                shareToFeed: entry.shareToFeed,
                plannedReleaseAt: plannedReleaseDate
                  ? new Date(`${plannedReleaseDate}T00:00:00Z`).toISOString()
                  : null,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setSaved(true);
              await onSaved();
            })
          }
          type="button"
        >
          Save package
        </Button>

        {entry.id && entry.latestRenderId && entry.revision !== null ? (
          <Button
            disabled={disabled}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await confirmReleasePackageAction({
                  projectId,
                  releasePackageId: entry.id,
                  renderId: entry.latestRenderId,
                  expectedRevision: entry.revision,
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                await onSaved();
              })
            }
            type="button"
            variant="outline"
          >
            {entry.reviewedRenderId
              ? "Review against the newest render"
              : "Confirm against this render"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
