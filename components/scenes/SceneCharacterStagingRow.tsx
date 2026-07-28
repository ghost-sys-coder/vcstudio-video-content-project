"use client";

import { useState, useTransition } from "react";
import { setSceneCharacterStagingAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import type { Character, SceneCharacterStageSlot } from "@/db/schema";

/**
 * Staging controls for one character in an animated scene: where it stands and
 * whether it speaks this scene's narration.
 *
 * Both controls save on change rather than behind a save button, matching the
 * rest of the scene planner. The speaking control is a radio sharing one group
 * name per scene version so the browser enforces exclusivity visually; the
 * database enforces it for real.
 */
export function SceneCharacterStagingRow({
  character,
  stageSlot,
  isSpeaker,
  canEdit,
  projectId,
  sceneId,
  sceneVersionId,
}: {
  character: Character;
  stageSlot: SceneCharacterStageSlot;
  isSpeaker: boolean;
  canEdit: boolean;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: { stageSlot: SceneCharacterStageSlot; speaks: boolean }) {
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("sceneId", sceneId);
      data.set("sceneVersionId", sceneVersionId);
      data.set("characterId", character.id);
      data.set("stageSlot", next.stageSlot);
      data.set("isSpeaker", next.speaks ? "true" : "false");
      const result = await setSceneCharacterStagingAction(data);
      if (!result.success) setError(result.error);
    });
  }

  const slotFieldId = `stage-slot-${sceneVersionId}-${character.id}`;
  const speakerFieldId = `speaker-${sceneVersionId}-${character.id}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-background px-3 py-2">
      <span className="min-w-24 flex-1 text-sm font-medium">
        {character.name}
        {character.status === "archived" ? (
          <span className="text-muted-foreground"> (archived)</span>
        ) : null}
      </span>

      <label className="text-xs text-muted-foreground" htmlFor={slotFieldId}>
        Position
      </label>
      <select
        className="h-8 rounded-lg border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canEdit || pending}
        id={slotFieldId}
        onChange={(event) =>
          save({
            stageSlot: event.target.value as SceneCharacterStageSlot,
            speaks: isSpeaker,
          })
        }
        value={stageSlot}
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </select>

      <label
        className="flex items-center gap-1.5 text-xs"
        htmlFor={speakerFieldId}
      >
        <input
          checked={isSpeaker}
          className="disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canEdit || pending}
          id={speakerFieldId}
          name={`speaker-${sceneVersionId}`}
          onChange={() => save({ stageSlot, speaks: true })}
          type="radio"
        />
        Speaking
      </label>

      {error ? (
        <span className="w-full text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
