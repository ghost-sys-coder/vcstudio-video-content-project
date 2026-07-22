"use client";

import { useMemo, useState, useTransition } from "react";
import { createShortCompositionAction } from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import { ShortClipRow } from "@/components/render/ShortClipRow";
import { StartRenderButton } from "@/components/render/StartRenderButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ShortCompositionView,
  ShortSourceSceneView,
} from "@/lib/render/render-view";
import {
  snapToNearestBoundary,
  type ShortDraftClip,
} from "@/lib/shorts/short-editor";

export function ShortsEditor({
  projectId,
  verticalOutputVariantId,
  sourceScenes,
  savedShorts,
  canEdit,
  onSaved,
  onRender,
  onPreview,
  renderPending,
}: {
  projectId: string;
  verticalOutputVariantId: string | null;
  sourceScenes: ShortSourceSceneView[];
  savedShorts: ShortCompositionView[];
  canEdit: boolean;
  onSaved: () => Promise<void>;
  onRender: (shortCompositionId: string) => void;
  onPreview: (shortCompositionId: string) => void;
  renderPending: boolean;
}) {
  const [name, setName] = useState("Untitled short");
  const [selectedSceneId, setSelectedSceneId] = useState(
    sourceScenes[0]?.sceneId ?? "",
  );
  const selectedScene = useMemo(
    () =>
      sourceScenes.find((scene) => scene.sceneId === selectedSceneId) ??
      sourceScenes[0] ??
      null,
    [selectedSceneId, sourceScenes],
  );
  const [startSeconds, setStartSeconds] = useState(
    (sourceScenes[0]?.startMilliseconds ?? 0) / 1000,
  );
  const [endSeconds, setEndSeconds] = useState(
    (sourceScenes[0]?.endMilliseconds ?? 0) / 1000,
  );
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [clips, setClips] = useState<ShortDraftClip[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectScene = (sceneId: string) => {
    const scene = sourceScenes.find((item) => item.sceneId === sceneId);
    setSelectedSceneId(sceneId);
    if (scene) {
      setStartSeconds(scene.startMilliseconds / 1000);
      setEndSeconds(scene.endMilliseconds / 1000);
    }
  };

  const durationMilliseconds = clips.reduce(
    (total, clip) =>
      total + (clip.sourceEndMilliseconds - clip.sourceStartMilliseconds),
    0,
  );

  return (
    <section className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Shorts editor</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Select precise ranges from the assembled source timeline. Audio is
          trimmed from the approved narration and captions are rebased—nothing
          is regenerated.
        </p>
      </div>

      {selectedScene && verticalOutputVariantId ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-3">
            <label className="block space-y-1 text-xs font-medium">
              Source scene
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                disabled={!canEdit || pending}
                onChange={(event) => selectScene(event.target.value)}
                value={selectedScene.sceneId}
              >
                {sourceScenes.map((scene) => (
                  <option key={scene.sceneId} value={scene.sceneId}>
                    Scene {scene.sceneNumber} ·{" "}
                    {(scene.startMilliseconds / 1000).toFixed(1)}s–
                    {(scene.endMilliseconds / 1000).toFixed(1)}s
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs font-medium">
                Start (seconds)
                <Input
                  disabled={!canEdit || pending}
                  max={selectedScene.endMilliseconds / 1000}
                  min={selectedScene.startMilliseconds / 1000}
                  onChange={(event) =>
                    setStartSeconds(Number(event.target.value))
                  }
                  step="0.1"
                  type="number"
                  value={startSeconds}
                />
              </label>
              <label className="block space-y-1 text-xs font-medium">
                End (seconds)
                <Input
                  disabled={!canEdit || pending}
                  max={selectedScene.endMilliseconds / 1000}
                  min={selectedScene.startMilliseconds / 1000}
                  onChange={(event) =>
                    setEndSeconds(Number(event.target.value))
                  }
                  step="0.1"
                  type="number"
                  value={endSeconds}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                checked={snapEnabled}
                className="size-4 accent-primary"
                disabled={!canEdit || pending}
                onChange={(event) => setSnapEnabled(event.target.checked)}
                type="checkbox"
              />
              Snap cuts to the nearest scene or subtitle boundary
            </label>
            <Button
              disabled={!canEdit || pending}
              nativeButton
              onClick={() => {
                const boundaries = [
                  selectedScene.startMilliseconds,
                  ...selectedScene.captionBoundariesMilliseconds,
                  selectedScene.endMilliseconds,
                ];
                const rawStart = Math.round(startSeconds * 1000);
                const rawEnd = Math.round(endSeconds * 1000);
                const start = snapEnabled
                  ? snapToNearestBoundary(rawStart, boundaries)
                  : rawStart;
                const end = snapEnabled
                  ? snapToNearestBoundary(rawEnd, boundaries)
                  : rawEnd;
                if (
                  start < selectedScene.startMilliseconds ||
                  end > selectedScene.endMilliseconds ||
                  end <= start
                ) {
                  setMessage("Choose a valid range inside this scene.");
                  return;
                }
                setClips((current) => [
                  ...current,
                  {
                    clientId: crypto.randomUUID(),
                    sourceSceneId: selectedScene.sceneId,
                    sourceSceneVersionId: selectedScene.sceneVersionId,
                    sceneNumber: selectedScene.sceneNumber,
                    sourceStartMilliseconds: start,
                    sourceEndMilliseconds: end,
                    transition: "cut",
                  },
                ]);
                setMessage(null);
              }}
              type="button"
              variant="outline"
            >
              Add clip
            </Button>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected clips
              </h3>
              <span className="text-xs text-muted-foreground">
                {(durationMilliseconds / 1000).toFixed(1)}s
              </span>
            </div>
            {clips.length ? (
              <ol className="max-h-72 min-w-0 space-y-2 overflow-y-auto pr-1">
                {clips.map((clip, index) => (
                  <ShortClipRow
                    clip={clip}
                    disabled={pending}
                    index={index}
                    key={clip.clientId}
                    onMove={(direction) => {
                      setClips((current) => {
                        const next = [...current];
                        const target = index + direction;
                        [next[index], next[target]] = [
                          next[target]!,
                          next[index]!,
                        ];
                        return next;
                      });
                    }}
                    onRemove={() =>
                      setClips((current) =>
                        current.filter(
                          (candidate) => candidate.clientId !== clip.clientId,
                        ),
                      )
                    }
                    total={clips.length}
                  />
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                Add one or more ranges in the order they should play.
              </p>
            )}
            <label className="block space-y-1 text-xs font-medium">
              Short name
              <Input
                disabled={!canEdit || pending}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>
            <Button
              disabled={!canEdit || pending || clips.length === 0}
              nativeButton
              onClick={() => {
                startTransition(async () => {
                  const formData = new FormData();
                  formData.set("projectId", projectId);
                  formData.set("outputVariantId", verticalOutputVariantId);
                  formData.set("name", name);
                  formData.set(
                    "clips",
                    JSON.stringify(
                      clips.map((clip, index) => ({
                        sourceSceneId: clip.sourceSceneId,
                        sourceSceneVersionId: clip.sourceSceneVersionId,
                        position: index + 1,
                        sourceStartMilliseconds: clip.sourceStartMilliseconds,
                        sourceEndMilliseconds: clip.sourceEndMilliseconds,
                        transition: clip.transition,
                      })),
                    ),
                  );
                  const result = await createShortCompositionAction(formData);
                  if (!result.success) {
                    setMessage(result.error);
                    return;
                  }
                  setMessage(
                    result.warnings.length
                      ? `Short saved. ${result.warnings[0]}`
                      : "Short saved and ready to render.",
                  );
                  setClips([]);
                  await onSaved();
                });
              }}
              type="button"
            >
              {pending ? "Saving short…" : "Save short"}
            </Button>
            {message ? (
              <p className="text-xs text-muted-foreground" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          The approved source timeline and vertical output are required before
          creating shorts.
        </p>
      )}

      {savedShorts.length ? (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved shorts
          </h3>
          <ul className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {savedShorts.map((short) => (
              <li className="min-w-0 rounded-lg border p-3" key={short.id}>
                <p className="truncate text-sm font-medium">{short.name}</p>
                <p className="text-xs text-muted-foreground">
                  {short.clipCount} clips ·{" "}
                  {(short.durationMilliseconds / 1000).toFixed(1)}s
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={renderPending}
                    nativeButton
                    onClick={() => onPreview(short.id)}
                    type="button"
                    variant="outline"
                  >
                    Preview
                  </Button>
                  <StartRenderButton
                    disabled={!canEdit || renderPending}
                    estimatedCostCents={short.estimatedRenderCostCents}
                    onStart={() => onRender(short.id)}
                    pending={renderPending}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
