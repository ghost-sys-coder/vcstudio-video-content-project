"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { savePacingProfileAction } from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import {
  PACING_PROFILES,
  PACING_PROFILE_IDS,
  type PacingProfileId,
} from "@/lib/pacing/pacing-profile";

/**
 * Chooses the rhythm the next render is cut to.
 *
 * The panel is careful about two things it would be easy to imply and wrong to
 * promise. Pacing does not change how long the video runs — the timeline is
 * built from the narration recording, so only the words and the voice decide
 * that — and it does not reach a render already made, because each one froze
 * its own motion and transitions when it was requested.
 */
export function PacingProfilePanel({
  canEdit,
  pacingProfile,
  projectId,
}: {
  canEdit: boolean;
  pacingProfile: PacingProfileId;
  projectId: string;
}) {
  const [selected, setSelected] = useState<PacingProfileId>(pacingProfile);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border bg-background p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Pacing</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        How much happens on screen while the narration plays. This does not
        change how long the video runs — the recording decides that — and it
        applies to the next render, not to exports you already have.
      </p>

      <form
        action={(formData) =>
          startTransition(async () => {
            const result = await savePacingProfileAction(formData);
            setSaved(result.success);
            setError(result.error);
          })
        }
        className="mt-4 space-y-4"
      >
        <input name="projectId" type="hidden" value={projectId} />

        <fieldset className="space-y-2" disabled={!canEdit || pending}>
          <legend className="sr-only">Pacing profile</legend>
          {PACING_PROFILE_IDS.map((id) => {
            const profile = PACING_PROFILES[id];
            return (
              <Label
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm font-normal has-checked:border-primary has-checked:bg-primary/5 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                key={id}
              >
                <input
                  checked={selected === id}
                  className="mt-1"
                  name="pacingProfile"
                  onChange={() => {
                    setSelected(id);
                    setSaved(false);
                  }}
                  type="radio"
                  value={id}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{profile.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {profile.description}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    About one image every{" "}
                    {Math.round(profile.millisecondsPerShot / 1000)}s ·{" "}
                    {profile.sceneTransition === "cut"
                      ? "hard cuts"
                      : "fades between scenes"}
                  </span>
                </span>
              </Label>
            );
          })}
        </fieldset>

        {canEdit ? (
          <Button
            disabled={pending || selected === pacingProfile}
            type="submit"
          >
            {pending ? "Saving…" : "Save pacing"}
          </Button>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p className="text-sm text-emerald-700" role="status">
            Saved. The next render uses this pace.
          </p>
        ) : null}
      </form>
    </section>
  );
}
