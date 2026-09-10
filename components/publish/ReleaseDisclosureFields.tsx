"use client";

import { Label } from "@/components/ui/label";
import {
  MADE_FOR_KIDS_GUIDANCE,
  SYNTHETIC_MEDIA_GUIDANCE,
} from "@/lib/publishing/youtube-disclosure";

/**
 * The declarations YouTube asks a creator to make about their own video.
 *
 * Both start unanswered and stay unanswered until someone chooses. There is no
 * preselected option, because the defect this replaces was exactly that: the
 * upload sent a constant "not made for kids" on behalf of a person who had
 * never been asked. An unanswered question blocks the upload and says so.
 */
export function ReleaseDisclosureFields({
  madeForKids,
  containsSyntheticMedia,
  playlistId,
  disabled,
  onMadeForKidsChange,
  onSyntheticMediaChange,
  onPlaylistChange,
}: {
  madeForKids: boolean | null;
  containsSyntheticMedia: boolean | null;
  playlistId: string;
  disabled: boolean;
  onMadeForKidsChange: (value: boolean) => void;
  onSyntheticMediaChange: (value: boolean) => void;
  onPlaylistChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <h4 className="text-sm font-semibold">Required by YouTube</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Your declarations, not this app&rsquo;s. Both must be answered before
          a YouTube release can be published or scheduled.
        </p>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-medium">
          Is this video made for kids?
        </legend>
        <p className="text-xs text-muted-foreground">
          {MADE_FOR_KIDS_GUIDANCE}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: true, label: "Yes, made for kids" },
            { value: false, label: "No, not made for kids" },
          ].map((option) => (
            <label
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                madeForKids === option.value
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "hover:bg-muted"
              }`}
              key={String(option.value)}
            >
              <input
                checked={madeForKids === option.value}
                className="sr-only"
                name="release-made-for-kids"
                onChange={() => onMadeForKidsChange(option.value)}
                type="radio"
              />
              {option.label}
            </label>
          ))}
        </div>
        {madeForKids === null ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Not answered yet.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-medium">
          Does this contain realistic altered or synthetic content?
        </legend>
        <p className="text-xs text-muted-foreground">
          {SYNTHETIC_MEDIA_GUIDANCE}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: true, label: "Yes, disclose it" },
            { value: false, label: "No, it does not" },
          ].map((option) => (
            <label
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                containsSyntheticMedia === option.value
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "hover:bg-muted"
              }`}
              key={String(option.value)}
            >
              <input
                checked={containsSyntheticMedia === option.value}
                className="sr-only"
                name="release-synthetic-media"
                onChange={() => onSyntheticMediaChange(option.value)}
                type="radio"
              />
              {option.label}
            </label>
          ))}
        </div>
        {containsSyntheticMedia === null ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Not answered yet.
          </p>
        ) : null}
      </fieldset>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="release-playlist">
          Playlist ID (optional)
        </Label>
        <input
          className="h-9 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={disabled}
          id="release-playlist"
          onChange={(event) => onPlaylistChange(event.target.value)}
          placeholder="PLxxxxxxxxxxxxxxxx"
          value={playlistId}
        />
        <p className="text-xs text-muted-foreground">
          Adding to a playlist needs broader YouTube permission than uploading.
          If this channel is connected for uploading only, the release will say
          so and tell you how to add it yourself.
        </p>
      </div>
    </div>
  );
}
