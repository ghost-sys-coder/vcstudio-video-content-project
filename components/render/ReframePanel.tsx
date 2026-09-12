"use client";

import { useEffect, useState } from "react";
import { ReframeTargetRow } from "@/components/render/ReframeTargetRow";
import type { ReframeTargetView } from "@/lib/reframe/reframe-job-view";

/**
 * Matches the other workspace panels. Fast enough that a bar visibly moves,
 * slow enough that a forty-scene job is not a query every second.
 */
const POLL_MILLISECONDS = 5_000;

/**
 * Turns a finished video into the other shapes it can be published in.
 *
 * Each shape is independent: a vertical cut that is still extending does not
 * hold up a square one, and each remembers its own last outcome.
 */
export function ReframePanel({
  canStart,
  projectId,
  targets: initialTargets,
}: {
  canStart: boolean;
  projectId: string;
  targets: ReframeTargetView[];
}) {
  const [targets, setTargets] = useState(initialTargets);
  const running = targets.some((target) => target.job?.active === true);

  // Polls only while something is actually running, and stops the moment
  // nothing is. A panel that keeps querying after the work finished is a
  // background cost nobody asked for.
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/reframe`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled && body?.success) setTargets(body.targets);
      } catch {
        // A dropped poll is not worth reporting: the next one recovers, and
        // the panel keeps showing the last state it knew.
      }
    }, POLL_MILLISECONDS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, running]);

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
