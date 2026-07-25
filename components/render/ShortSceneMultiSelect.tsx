"use client";

import { useMemo, useState } from "react";
import { StoryboardSelectionCheckbox } from "@/components/storyboard/StoryboardSelectionCheckbox";
import { Button } from "@/components/ui/button";
import type { ShortSourceSceneView } from "@/lib/render/render-view";
import { sumDurationMilliseconds } from "@/lib/shorts/short-editor";

export function ShortSceneMultiSelect({
  availableScenes,
  disabled,
  onAddSelected,
}: {
  availableScenes: ShortSourceSceneView[];
  disabled: boolean;
  onAddSelected: (sceneIds: string[]) => void;
}) {
  const [checkedSceneIds, setCheckedSceneIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const checkedScenes = useMemo(
    () => availableScenes.filter((scene) => checkedSceneIds.has(scene.sceneId)),
    [availableScenes, checkedSceneIds],
  );
  const combinedDurationMilliseconds = sumDurationMilliseconds(checkedScenes);

  function toggle(sceneId: string, checked: boolean) {
    setCheckedSceneIds((current) => {
      const next = new Set(current);
      if (checked) next.add(sceneId);
      else next.delete(sceneId);
      return next;
    });
  }

  return (
    <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Select scenes
        </h3>
        <div className="flex gap-2">
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
            disabled={disabled || availableScenes.length === 0}
            onClick={() =>
              setCheckedSceneIds(
                new Set(availableScenes.map((scene) => scene.sceneId)),
              )
            }
            type="button"
          >
            Select all
          </button>
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
            disabled={disabled || checkedSceneIds.size === 0}
            onClick={() => setCheckedSceneIds(new Set())}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      {availableScenes.length ? (
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {availableScenes.map((scene) => (
            <li
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
              key={scene.sceneId}
            >
              <StoryboardSelectionCheckbox
                checked={checkedSceneIds.has(scene.sceneId)}
                disabled={disabled}
                label={`Select scene ${scene.sceneNumber}`}
                onChange={(checked) => toggle(scene.sceneId, checked)}
              />
              <button
                className="min-w-0 flex-1 truncate text-left"
                disabled={disabled}
                onClick={() =>
                  toggle(scene.sceneId, !checkedSceneIds.has(scene.sceneId))
                }
                type="button"
              >
                Scene {scene.sceneNumber} ·{" "}
                {(scene.startMilliseconds / 1000).toFixed(1)}s–
                {(scene.endMilliseconds / 1000).toFixed(1)}s
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Every scene has already been added to this short.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {checkedSceneIds.size} selected ·{" "}
          {(combinedDurationMilliseconds / 1000).toFixed(1)}s combined
        </span>
        <Button
          disabled={disabled || checkedSceneIds.size === 0}
          nativeButton
          onClick={() => {
            onAddSelected(checkedScenes.map((scene) => scene.sceneId));
            setCheckedSceneIds(new Set());
          }}
          type="button"
          variant="outline"
        >
          Add {checkedSceneIds.size || ""} selected scene
          {checkedSceneIds.size === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
