"use client";

import { useMemo } from "react";
import type { AudioSceneView } from "@/lib/audio/audio-view";
import {
  isWorthTrimming,
  summariseSceneSilence,
  type SceneSilenceRow,
} from "@/lib/audio/scene-silence";

/**
 * Where the video is standing still, and what it would run to without it.
 *
 * A scene that feels slow is usually not slow speech: it is a clip that opens
 * with room tone before the first word and runs on after the last. This says
 * which scenes those are and by how much, so the decision is about specific
 * seconds in specific places rather than a vague sense that the video drags.
 *
 * **It reports; it does not cut.** Scene boundaries feed the subtitle track
 * before the render timeline is built, so a trim applied anywhere but the one
 * place durations enter would desynchronise the captions of a paid render.
 * The measurement is safe to show today; the cut is deliberately not wired
 * until it can be applied in that single place.
 */

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function clock(milliseconds: number): string {
  const total = Math.round(milliseconds / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function SilenceAuditPanel({ scenes }: { scenes: AudioSceneView[] }) {
  const rows = useMemo<SceneSilenceRow[]>(
    () =>
      scenes
        .filter((scene) => scene.silence !== null)
        .map((scene) => ({
          sceneId: scene.sceneId,
          sceneNumber: scene.sceneNumber,
          durationMilliseconds: scene.durationMilliseconds ?? 0,
          silence: scene.silence!,
        })),
    [scenes],
  );

  const summary = useMemo(() => summariseSceneSilence(rows), [rows]);
  const trimmable = useMemo(
    () =>
      rows
        .filter((row) => isWorthTrimming(row.silence))
        .sort(
          (left, right) =>
            right.silence.savedMilliseconds - left.silence.savedMilliseconds,
        ),
    [rows],
  );

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-background p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Dead air</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Silence at the start and end of each approved narration clip, measured
        from the recording itself. Removing it shortens the video without
        changing how anything is spoken.
      </p>

      {trimmable.length === 0 ? (
        <p className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          No scene carries enough dead air to be worth cutting. The narration
          starts and ends close to the words.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <dt className="text-xs text-muted-foreground">Could be saved</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {seconds(summary.totalSavedMilliseconds)}
              </dd>
            </div>
            <div className="rounded-xl border p-3">
              <dt className="text-xs text-muted-foreground">Scenes affected</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {summary.trimmableSceneCount}
              </dd>
            </div>
            <div className="rounded-xl border p-3">
              <dt className="text-xs text-muted-foreground">
                Runtime, now and trimmed
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {clock(summary.currentDurationMilliseconds)} →{" "}
                {clock(summary.trimmedDurationMilliseconds)}
              </dd>
            </div>
          </dl>

          <ul className="mt-4 divide-y rounded-xl border">
            {trimmable.map((row) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
                key={row.sceneId}
              >
                <span className="font-medium">Scene {row.sceneNumber}</span>
                <span className="text-xs text-muted-foreground">
                  {seconds(row.silence.leadingMilliseconds)} at the start ·{" "}
                  {seconds(row.silence.trailingMilliseconds)} at the end
                </span>
                <span className="tabular-nums">
                  {seconds(row.silence.savedMilliseconds)} saved
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {summary.unmeasuredSceneCount > 0 ? (
        // Said rather than hidden: these scenes are not silent, they are
        // unmeasured, and the difference decides whether the figure above is
        // the whole story.
        <p className="mt-3 text-xs text-muted-foreground">
          {summary.unmeasuredSceneCount}{" "}
          {summary.unmeasuredSceneCount === 1
            ? "scene carries"
            : "scenes carry"}{" "}
          no loudness measurement, so nothing could be checked there. Narration
          generated before that measurement existed, or recorded elsewhere, is
          not included in these totals.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Reporting only for now. Trimming has to be applied where scene durations
        are set, because caption times are laid out from those durations before
        the video is assembled.
      </p>
    </section>
  );
}
