"use client";

import { useMemo, useState, useTransition } from "react";
import { applySceneFramingToScenesAction } from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import { StoryboardSelectionCheckbox } from "@/components/storyboard/StoryboardSelectionCheckbox";
import { Button } from "@/components/ui/button";
import type { RenderSceneFramingView } from "@/lib/render/render-view";
import type { SceneFramingData } from "@/lib/output-variants/scene-framing";

export function SceneFramingBulkApply({
  projectId,
  outputVariantId,
  activeSceneId,
  scenes,
  framing,
  disabled,
  onApplied,
}: {
  projectId: string;
  outputVariantId: string;
  activeSceneId: string;
  scenes: RenderSceneFramingView[];
  framing: SceneFramingData;
  disabled: boolean;
  onApplied: () => Promise<void>;
}) {
  const candidates = useMemo(
    () =>
      scenes.filter(
        (scene) => scene.sceneId !== activeSceneId && !scene.hasNativeMatch,
      ),
    [activeSceneId, scenes],
  );
  const [checkedSceneIds, setCheckedSceneIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(sceneId: string, checked: boolean) {
    setCheckedSceneIds((current) => {
      const next = new Set(current);
      if (checked) next.add(sceneId);
      else next.delete(sceneId);
      return next;
    });
  }

  function apply() {
    const targets = candidates
      .filter((scene) => checkedSceneIds.has(scene.sceneId))
      .map((scene) => ({
        sceneId: scene.sceneId,
        sceneVersionId: scene.sceneVersionId,
        sourceImageGenerationId: scene.approvedSourceImageGenerationId,
      }));
    if (targets.length === 0) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("outputVariantId", outputVariantId);
      formData.set("mode", framing.mode);
      formData.set("focalPointXBps", String(framing.focalPointXBps));
      formData.set("focalPointYBps", String(framing.focalPointYBps));
      formData.set("scaleBps", String(framing.scaleBps));
      formData.set("backgroundColor", framing.backgroundColor);
      formData.set("targets", JSON.stringify(targets));
      const result = await applySceneFramingToScenesAction(formData);
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage(
        `Applied to ${targets.length} scene${targets.length === 1 ? "" : "s"}.`,
      );
      setCheckedSceneIds(new Set());
      await onApplied();
    });
  }

  if (candidates.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Apply this framing to other scenes
        </h3>
        <div className="flex gap-2">
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
            disabled={disabled || pending}
            onClick={() =>
              setCheckedSceneIds(
                new Set(candidates.map((scene) => scene.sceneId)),
              )
            }
            type="button"
          >
            Select all
          </button>
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
            disabled={disabled || pending || checkedSceneIds.size === 0}
            onClick={() => setCheckedSceneIds(new Set())}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
        {candidates.map((scene) => (
          <li
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            key={scene.sceneId}
          >
            <StoryboardSelectionCheckbox
              checked={checkedSceneIds.has(scene.sceneId)}
              disabled={disabled || pending}
              label={`Include scene ${scene.sceneNumber}`}
              onChange={(checked) => toggle(scene.sceneId, checked)}
            />
            <button
              className="min-w-0 flex-1 truncate text-left"
              disabled={disabled || pending}
              onClick={() =>
                toggle(scene.sceneId, !checkedSceneIds.has(scene.sceneId))
              }
              type="button"
            >
              Scene {scene.sceneNumber}
            </button>
          </li>
        ))}
      </ul>

      <Button
        disabled={disabled || pending || checkedSceneIds.size === 0}
        nativeButton
        onClick={apply}
        type="button"
        variant="outline"
      >
        {pending
          ? "Applying…"
          : `Apply to ${checkedSceneIds.size || ""} selected scene${checkedSceneIds.size === 1 ? "" : "s"}`}
      </Button>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
