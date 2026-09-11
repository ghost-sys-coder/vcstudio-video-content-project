"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveRenderEffectsAction } from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import type { RenderEffectsView } from "@/lib/render/render-effects-view";

const METER_POSITIONS = [
  { value: "bottomRight", label: "Bottom right" },
  { value: "bottomLeft", label: "Bottom left" },
  { value: "bottomCenter", label: "Bottom centre" },
  { value: "topRight", label: "Top right" },
  { value: "topLeft", label: "Top left" },
  { value: "topCenter", label: "Top centre" },
] as const;

/**
 * Sets the sound bed under the video and the narration level meter drawn over
 * it.
 *
 * Both are saved together as one row under an optimistic lock, so the form
 * carries the revision it was loaded with and a save made against a stale copy
 * is refused rather than silently overwriting somebody else's change.
 */
export function RenderEffectsPanel({
  canEdit,
  effects,
  projectId,
}: {
  canEdit: boolean;
  effects: RenderEffectsView;
  projectId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [meterEnabled, setMeterEnabled] = useState(effects.levelMeterEnabled);
  const [volume, setVolume] = useState(effects.backgroundVolumePercent);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border bg-background p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Sound and motion</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A sound bed under the whole video, and a meter that moves with the
        narration. Both apply to every scene.
      </p>

      {effects.droppedBackgroundReason ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {effects.droppedBackgroundReason === "deleted"
            ? "The chosen sound file was deleted from the media library, so renders will have no background sound until you choose another."
            : effects.droppedBackgroundReason === "notReady"
              ? "The chosen sound file has not finished uploading, so renders will have no background sound yet."
              : "The chosen sound file could not be found, so renders will have no background sound."}
        </p>
      ) : null}

      <form
        action={(formData) =>
          startTransition(async () => {
            const result = await saveRenderEffectsAction(formData);
            setSaved(result.success);
            setError(result.error);
          })
        }
        className="mt-4 space-y-4"
      >
        <input name="projectId" type="hidden" value={projectId} />
        <input
          name="expectedRevision"
          type="hidden"
          value={effects.revision ?? ""}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="effects-background">
            Background sound
          </label>
          <select
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            defaultValue={effects.backgroundMediaAssetId ?? ""}
            disabled={!canEdit}
            id="effects-background"
            name="backgroundMediaAssetId"
          >
            <option value="">No background sound</option>
            {effects.availableAudio.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.title}
              </option>
            ))}
          </select>
          {effects.availableAudio.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No audio in the media library yet. Upload a track there and it
              becomes available to every project in this workspace.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="effects-volume">
              Bed volume: {volume}%
            </label>
            <input
              className="w-full"
              disabled={!canEdit}
              id="effects-volume"
              max={100}
              min={0}
              name="backgroundVolumePercent"
              onChange={(event) => setVolume(Number(event.target.value))}
              step={1}
              type="range"
              value={volume}
            />
            <p className="text-xs text-muted-foreground">
              A bed that competes with the narration is worse than no bed. Zero
              renders as no background sound at all.
            </p>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Looping</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                defaultChecked={effects.backgroundLoop}
                disabled={!canEdit}
                name="backgroundLoop"
                type="checkbox"
              />
              Repeat the track until the video ends
            </label>
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={meterEnabled}
              disabled={!canEdit}
              name="levelMeterEnabled"
              onChange={(event) => setMeterEnabled(event.target.checked)}
              type="checkbox"
            />
            Draw a narration level meter
          </label>
          <p className="text-xs text-muted-foreground">
            Bars that rise and fall with the narration&apos;s measured loudness,
            from the same measurement that drives mouth movement. It shows
            loudness, not speech: a cough or a loud room moves it too.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="effects-position">
              Meter position
            </label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-64"
              defaultValue={effects.levelMeterPosition}
              disabled={!canEdit || !meterEnabled}
              id="effects-position"
              name="levelMeterPosition"
            >
              {METER_POSITIONS.map((position) => (
                <option key={position.value} value={position.value}>
                  {position.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p className="text-sm text-muted-foreground" role="status">
            Saved. New renders will use these settings; renders already started
            keep the settings they were requested with.
          </p>
        ) : null}

        {canEdit ? (
          <Button disabled={pending} size="sm" type="submit">
            {pending ? "Saving..." : "Save sound and motion"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only owners and editors can change these.
          </p>
        )}
      </form>
    </section>
  );
}
