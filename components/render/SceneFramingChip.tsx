"use client";

import { cn } from "@/lib/utils";
import type { RenderSceneFramingView } from "@/lib/render/render-view";

function statusDotClassName(scene: RenderSceneFramingView): string | null {
  if (scene.outpaintStatus === "failed") return "bg-destructive";
  if (scene.outpaintStatus === "queued" || scene.outpaintStatus === "running")
    return "bg-amber-500";
  if (scene.customized) return "bg-primary";
  return null;
}

export function SceneFramingChip({
  scene,
  active,
  onSelect,
}: {
  scene: RenderSceneFramingView;
  active: boolean;
  onSelect: () => void;
}) {
  const dotClassName = statusDotClassName(scene);
  return (
    <button
      aria-pressed={active}
      className={cn(
        "relative shrink-0 rounded-md border px-3 py-2 text-xs font-medium",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted",
      )}
      onClick={onSelect}
      type="button"
    >
      Scene {scene.sceneNumber}
      {dotClassName ? (
        <span
          aria-hidden
          className={cn(
            "absolute -right-1 -top-1 size-2 rounded-full ring-2 ring-background",
            dotClassName,
          )}
        />
      ) : null}
    </button>
  );
}
