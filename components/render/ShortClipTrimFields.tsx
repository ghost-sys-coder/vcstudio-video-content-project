"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShortSourceSceneView } from "@/lib/render/render-view";
import {
  snapToNearestBoundary,
  type ShortDraftClip,
} from "@/lib/shorts/short-editor";

/**
 * Rendered with `key={clip.clientId}` by the parent so switching the active
 * clip remounts this with fresh initial state instead of syncing state in an
 * effect.
 */
export function ShortClipTrimFields({
  clip,
  scene,
  disabled,
  onUpdateClip,
}: {
  clip: ShortDraftClip;
  scene: ShortSourceSceneView;
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
  const [startSeconds, setStartSeconds] = useState(
    clip.sourceStartMilliseconds / 1000,
  );
  const [endSeconds, setEndSeconds] = useState(
    clip.sourceEndMilliseconds / 1000,
  );
  const [transition, setTransition] = useState<"cut" | "fade">(clip.transition);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1 text-xs font-medium">
          Start (seconds)
          <Input
            disabled={disabled}
            max={scene.endMilliseconds / 1000}
            min={scene.startMilliseconds / 1000}
            onChange={(event) => setStartSeconds(Number(event.target.value))}
            step="0.1"
            type="number"
            value={startSeconds}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium">
          End (seconds)
          <Input
            disabled={disabled}
            max={scene.endMilliseconds / 1000}
            min={scene.startMilliseconds / 1000}
            onChange={(event) => setEndSeconds(Number(event.target.value))}
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
          disabled={disabled}
          onChange={(event) => setSnapEnabled(event.target.checked)}
          type="checkbox"
        />
        Snap cuts to the nearest scene or subtitle boundary
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Transition in</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["cut", "fade"] as const).map((value) => (
            <Button
              aria-pressed={transition === value}
              disabled={disabled}
              key={value}
              nativeButton
              onClick={() => setTransition(value)}
              type="button"
              variant={transition === value ? "default" : "outline"}
            >
              {value === "cut" ? "Cut" : "Fade"}
            </Button>
          ))}
        </div>
      </fieldset>

      <Button
        disabled={disabled}
        nativeButton
        onClick={() => {
          const boundaries = [
            scene.startMilliseconds,
            ...scene.captionBoundariesMilliseconds,
            scene.endMilliseconds,
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
            start < scene.startMilliseconds ||
            end > scene.endMilliseconds ||
            end <= start
          ) {
            setMessage("Choose a valid range inside this scene.");
            return;
          }
          onUpdateClip(clip.clientId, {
            sourceStartMilliseconds: start,
            sourceEndMilliseconds: end,
            transition,
          });
          setStartSeconds(start / 1000);
          setEndSeconds(end / 1000);
          setMessage("Clip updated.");
        }}
        type="button"
        variant="outline"
      >
        Update clip
      </Button>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
