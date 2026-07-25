"use client";

import { useMemo, useState } from "react";
import { ShortClipTrimFields } from "@/components/render/ShortClipTrimFields";
import { cn } from "@/lib/utils";
import type { ShortSourceSceneView } from "@/lib/render/render-view";
import type { ShortDraftClip } from "@/lib/shorts/short-editor";

export function ShortClipTrimEditor({
  clips,
  sourceScenes,
  disabled,
  onUpdateClip,
}: {
  clips: ShortDraftClip[];
  sourceScenes: ShortSourceSceneView[];
  disabled: boolean;
  onUpdateClip: (
    clientId: string,
    patch: {
      sourceStartMilliseconds: number;
      sourceEndMilliseconds: number;
      transition: "cut" | "fade";
    },
  ) => void;
}) {
  const [activeClientId, setActiveClientId] = useState(
    clips[0]?.clientId ?? "",
  );
  const active = useMemo(
    () =>
      clips.find((clip) => clip.clientId === activeClientId) ??
      clips[0] ??
      null,
    [activeClientId, clips],
  );
  const activeScene = useMemo(
    () =>
      active
        ? (sourceScenes.find(
            (scene) => scene.sceneId === active.sourceSceneId,
          ) ?? null)
        : null,
    [active, sourceScenes],
  );

  if (!active || !activeScene) return null;

  return (
    <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Edit a clip
      </h3>
      <div
        aria-label="Added clips"
        className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1"
      >
        {clips.map((clip) => (
          <button
            aria-pressed={clip.clientId === active.clientId}
            className={cn(
              "shrink-0 rounded-md border px-3 py-2 text-xs font-medium",
              clip.clientId === active.clientId
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
            key={clip.clientId}
            onClick={() => setActiveClientId(clip.clientId)}
            type="button"
          >
            Scene {clip.sceneNumber}
          </button>
        ))}
      </div>

      <ShortClipTrimFields
        clip={active}
        disabled={disabled}
        key={active.clientId}
        onUpdateClip={onUpdateClip}
        scene={activeScene}
      />
    </div>
  );
}
