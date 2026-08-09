"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FirstValueTrackCard } from "@/components/onboarding/FirstValueTrackCard";
import type { FirstValueTrack } from "@/lib/onboarding/first-value-onboarding";

export function FirstValueOnboardingPanel({
  tracks,
}: {
  tracks: FirstValueTrack[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const allRequiredComplete = tracks.every((track) =>
    track.milestones
      .filter((milestone) => !milestone.optional)
      .every((milestone) => milestone.complete),
  );
  useEffect(() => {
    setDismissed(
      window.localStorage.getItem("vcstudio:first-value-dismissed") === "true",
    );
  }, []);
  if (dismissed && allRequiredComplete) return null;
  return (
    <section className="space-y-4" aria-labelledby="first-value-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Getting started
          </p>
          <h2 id="first-value-heading" className="text-xl font-semibold">
            Reach your first useful output
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Progress comes from real workspace activity and stays accurate for
            every member.
          </p>
        </div>
        {allRequiredComplete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.localStorage.setItem(
                "vcstudio:first-value-dismissed",
                "true",
              );
              setDismissed(true);
            }}
          >
            Dismiss
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {tracks.map((track) => (
          <FirstValueTrackCard key={track.id} track={track} />
        ))}
      </div>
    </section>
  );
}
