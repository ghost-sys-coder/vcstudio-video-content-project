"use client";

import { ReframeTargetRow } from "@/components/render/ReframeTargetRow";
import type { ReframeTargetView } from "@/lib/reframe/reframe-job-view";

/**
 * Turns a finished video into the other shapes it can be published in.
 *
 * Each shape is independent: a vertical cut that is still extending does not
 * hold up a square one, and each remembers its own last outcome.
 */
export function ReframePanel({
  canStart,
  projectId,
  targets,
}: {
  canStart: boolean;
  projectId: string;
  targets: ReframeTargetView[];
}) {
  if (targets.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-background p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Reframe for other platforms</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Extends each scene&apos;s image onto the new canvas rather than cropping
        it, then renders the whole video in that shape. Cropping a landscape
        still into a vertical one throws away about two thirds of the picture,
        which is why extending is the default.
      </p>

      <ul className="mt-4 space-y-3">
        {targets.map((target) => (
          <ReframeTargetRow
            canStart={canStart}
            key={target.outputVariantId}
            projectId={projectId}
            target={target}
          />
        ))}
      </ul>

      {canStart ? null : (
        <p className="mt-3 text-sm text-muted-foreground">
          Only owners and editors can start a reframe.
        </p>
      )}
    </section>
  );
}
