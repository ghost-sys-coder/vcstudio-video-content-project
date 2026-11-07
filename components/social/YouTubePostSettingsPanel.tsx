"use client";
import { useState } from "react";

import type { SocialYouTubeSettings } from "@studio/contracts/publishing";
import { MediaPickerDialog } from "./MediaPickerDialog";
import { MediaAssetPreview } from "./MediaAssetPreview";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { youTubeThumbnailProblem } from "@/lib/social/youtube-post-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";

export function YouTubePostSettingsPanel({
  value,
  onChange,
  thumbnail,
  onThumbnailChange,
  disabled,
  unsaved,
  onSave,
  saving,
  scheduled = false,
}: {
  value: SocialYouTubeSettings;
  onChange: (value: SocialYouTubeSettings) => void;
  thumbnail: MediaAssetView | null;
  onThumbnailChange: (value: MediaAssetView | null) => void;
  disabled: boolean;
  unsaved: boolean;
  onSave: () => void;
  saving: boolean;
  scheduled?: boolean;
}) {
  const [tagsText, setTagsText] = useState(value.tags.join(", "));
  return (
    <section
      className="app-panel min-w-0 space-y-5"
      aria-labelledby="youtube-settings-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="app-heading">
          <h2 id="youtube-settings-heading" className="text-lg font-semibold">
            YouTube upload
          </h2>
          <p className="text-sm text-muted-foreground">
            Details for long-form videos and Shorts. The thumbnail is separate
            from your video attachment.
          </p>
        </div>
        <Badge variant="secondary">Videos &amp; Shorts</Badge>
      </div>
      {scheduled && (
        <p role="status" className="rounded-xl border bg-muted/30 p-3 text-sm">
          Cancel the saved schedule before changing YouTube settings or its
          thumbnail. The current schedule keeps the details you approved.
        </p>
      )}
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.45fr)]">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="youtube-post-title">Video title</Label>
          <Input
            id="youtube-post-title"
            value={value.title}
            maxLength={100}
            disabled={disabled}
            placeholder="Uses the first line of your post if empty"
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="youtube-post-visibility">Visibility</Label>
          <FormSelect
            id="youtube-post-visibility"
            value={value.visibility}
            disabled={disabled}
            onValueChange={(visibility) => {
              if (
                visibility === "public" ||
                visibility === "private" ||
                visibility === "unlisted"
              )
                onChange({ ...value, visibility });
            }}
          >
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="unlisted">Unlisted</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </FormSelect>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="youtube-post-description">YouTube description</Label>
        <Textarea
          id="youtube-post-description"
          value={value.description ?? ""}
          maxLength={5000}
          disabled={disabled}
          placeholder="Uses your post text while this field is unset"
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
        <Button
          size="sm"
          variant="link"
          disabled={disabled || value.description === null}
          type="button"
          onClick={() => onChange({ ...value, description: null })}
        >
          Use post text
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="youtube-post-tags">Tags</Label>
        <Input
          id="youtube-post-tags"
          value={tagsText}
          disabled={disabled}
          placeholder="Comma-separated tags"
          onChange={(e) => {
            setTagsText(e.target.value);
            onChange({
              ...value,
              tags: e.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Up to 30 tags and 500 characters total.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="youtube-post-audience">
            Is this video made for kids?
          </Label>
          <FormSelect
            id="youtube-post-audience"
            value={
              value.madeForKids === null
                ? "unanswered"
                : String(value.madeForKids)
            }
            disabled={disabled}
            onValueChange={(answer) =>
              onChange({
                ...value,
                madeForKids: answer === "unanswered" ? null : answer === "true",
              })
            }
          >
            <SelectItem value="unanswered">Choose an answer</SelectItem>
            <SelectItem value="true">Yes, made for kids</SelectItem>
            <SelectItem value="false">No, not made for kids</SelectItem>
          </FormSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="youtube-post-synthetic">
            Realistic altered or synthetic content?
          </Label>
          <FormSelect
            id="youtube-post-synthetic"
            value={
              value.containsSyntheticMedia === null
                ? "unanswered"
                : String(value.containsSyntheticMedia)
            }
            disabled={disabled}
            onValueChange={(answer) =>
              onChange({
                ...value,
                containsSyntheticMedia:
                  answer === "unanswered" ? null : answer === "true",
              })
            }
          >
            <SelectItem value="unanswered">Choose an answer</SelectItem>
            <SelectItem value="true">Yes, disclose it</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </FormSelect>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Both declarations must reflect your video. Realistic AI-generated or
        meaningfully altered content may require disclosure; the app does not
        choose these answers for you.
      </p>
      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium">Custom thumbnail</h3>
          {!disabled && (
            <MediaPickerDialog
              attachedIds={[]}
              recentAssets={[]}
              kind="image"
              selectionLimit={1}
              triggerLabel={thumbnail ? "Change thumbnail" : "Choose thumbnail"}
              title="Choose a YouTube thumbnail"
              description="Choose one ready JPEG or PNG. Upload a new image in the media library first if needed."
              confirmLabel="Use thumbnail"
              confirmDescription="Selects the thumbnail. Save the draft to keep your choice."
              onConfirm={async (assets) => {
                const problem = youTubeThumbnailProblem(assets[0]);
                if (problem) return { ok: false, error: problem };
                onThumbnailChange(assets[0]);
                return { ok: true };
              }}
            />
          )}
        </div>
        {thumbnail ? (
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-40 shrink-0 overflow-hidden rounded-lg border">
              <MediaAssetPreview asset={thumbnail} controls={false} />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="break-words text-sm font-medium">
                {thumbnail.title}
              </p>
              <Button
                disabled={disabled}
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onThumbnailChange(null)}
              >
                Remove thumbnail
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            YouTube will choose a thumbnail if you do not select one.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Your channel needs custom-thumbnail permission. Use 16:9 for long-form
          or 9:16 for Shorts. VCStudio waits for YouTube processing before
          applying the image.
        </p>
      </div>
      {unsaved && !disabled && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3 text-sm"
        >
          <span>YouTube settings have unsaved changes.</span>
          <Button size="sm" disabled={saving} onClick={onSave} type="button">
            {saving ? "Saving…" : "Save YouTube settings"}
          </Button>
        </div>
      )}
    </section>
  );
}
