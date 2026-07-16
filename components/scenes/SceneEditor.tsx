"use client";

import { useState, useTransition } from "react";
import type { Scene, SceneVersion } from "@/db/schema";
import { updateSceneAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SceneNarrationField } from "@/components/scenes/SceneNarrationField";
import { SceneVisualDescriptionField } from "@/components/scenes/SceneVisualDescriptionField";
import { SceneCameraControls } from "@/components/scenes/SceneCameraControls";
import { SceneCharacterSelector } from "@/components/scenes/SceneCharacterSelector";
import { SceneDurationField } from "@/components/scenes/SceneDurationField";

export function SceneEditor({
  scene,
  version,
  canEdit,
  onDirtyChange,
}: {
  scene: Scene;
  version: SceneVersion;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={(data) =>
        startTransition(async () => {
          const result = await updateSceneAction(data);
          setMessage(result.error ?? "Scene saved as a new version.");
          if (result.success) onDirtyChange?.(false);
        })
      }
      className="space-y-4"
      onChange={() => onDirtyChange?.(true)}
    >
      <input name="projectId" type="hidden" value={scene.projectId} />
      <input name="sceneId" type="hidden" value={scene.id} />
      <input
        name="expectedVersion"
        type="hidden"
        value={scene.currentVersion}
      />
      <SceneNarrationField
        defaultValue={version.narrationText}
        disabled={!canEdit || pending}
        id={`scene-${scene.id}-narrationText`}
      />
      <SceneVisualDescriptionField
        defaultValue={version.visualDescription}
        disabled={!canEdit || pending}
        id={`scene-${scene.id}-visualDescription`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["locationDescription", "Location", version.locationDescription],
          ["actionDescription", "Action", version.actionDescription],
        ].map(([name, label, value]) => (
          <div className="space-y-2" key={name}>
            <Label htmlFor={`${name}-${scene.id}`}>{label}</Label>
            <Textarea
              defaultValue={value}
              disabled={!canEdit || pending}
              id={`${name}-${scene.id}`}
              name={name}
              required
            />
          </div>
        ))}
      </div>
      <SceneCameraControls
        angle={version.cameraAngle}
        disabled={!canEdit || pending}
        idPrefix={`scene-${scene.id}`}
        motion={version.cameraMotion}
        shot={version.cameraShot}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`tone-${scene.id}`}>Emotional tone</Label>
          <Input
            defaultValue={version.emotionalTone}
            disabled={!canEdit || pending}
            id={`tone-${scene.id}`}
            name="emotionalTone"
            required
          />
        </div>
        <SceneDurationField
          disabled={!canEdit || pending}
          id={`scene-${scene.id}-estimatedDurationMilliseconds`}
          value={version.estimatedDurationMilliseconds}
        />
      </div>
      <SceneCharacterSelector
        characters={version.characterNames}
        disabled={!canEdit || pending}
        idPrefix={`scene-${scene.id}`}
        props={version.propNames}
      />
      <div className="space-y-2">
        <Label htmlFor={`continuity-${scene.id}`}>Continuity notes</Label>
        <Textarea
          defaultValue={version.continuityNotes}
          disabled={!canEdit || pending}
          id={`continuity-${scene.id}`}
          name="continuityNotes"
        />
      </div>
      {canEdit ? (
        <Button disabled={pending} type="submit" variant="outline">
          {pending ? "Saving…" : "Save new version"}
        </Button>
      ) : null}
      {message ? (
        <p
          className={
            message.includes("saved")
              ? "text-sm text-emerald-700"
              : "text-sm text-destructive"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
