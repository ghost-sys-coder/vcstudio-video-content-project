"use client";

import { useRef, useState, useTransition } from "react";
import type { Scene, SceneVersion } from "@/db/schema";
import {
  updateSceneAction,
  previewSceneRevisionAction,
} from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { SceneRevisionConfirmDialog } from "@/components/scenes/SceneRevisionConfirmDialog";
import { SceneSaveBar } from "@/components/scenes/SceneSaveBar";
import type { SceneRevisionEstimateView } from "@/lib/scenes/scene-revision-view";
import {
  describeSceneSaveImpact,
  describeSceneSaveState,
} from "@/lib/scenes/describe-scene-save";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SceneNarrationField } from "@/components/scenes/SceneNarrationField";
import { SceneVisualDescriptionField } from "@/components/scenes/SceneVisualDescriptionField";
import { SceneCameraControls } from "@/components/scenes/SceneCameraControls";
import { SceneCharacterSelector } from "@/components/scenes/SceneCharacterSelector";
import { SceneDurationField } from "@/components/scenes/SceneDurationField";
import {
  hasSceneContentChanged,
  sceneMediaCompatibility,
} from "@/lib/domain/scene-revision";
import { parseSceneEditorInput } from "@/lib/scenes/scene-editor-input";

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
  const formReference = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  /** Set only when the edit destroys finished work, which opens the dialog. */
  const [confirming, setConfirming] =
    useState<SceneRevisionEstimateView | null>(null);
  const [compatibility, setCompatibility] = useState({
    image: true,
    audio: true,
  });

  async function save(data: FormData) {
    const result = await updateSceneAction(data);
    setSucceeded(result.success);
    setMessage(
      result.error ??
        (result.changed
          ? "Scene saved as a new version. It is in review, not approved."
          : "No changes to save."),
    );
    if (result.success) {
      setChanged(false);
      setConfirming(null);
      onDirtyChange?.(false);
    }
  }

  function confirmSave() {
    const form = formReference.current;
    if (!form) return;
    // Read the fields again rather than replaying what was submitted: the form
    // is uncontrolled, so this is the only copy guaranteed to be current.
    const data = new FormData(form);
    startTransition(async () => {
      try {
        await save(data);
      } catch {
        setSucceeded(false);
        setConfirming(null);
        setMessage(
          "The request could not complete. Your changes are still here; try again.",
        );
      }
    });
  }

  return (
    <form
      ref={formReference}
      onSubmit={(event) => {
        // React form actions reset uncontrolled fields after returning, and a
        // recoverable failure must not cost the creator their draft.
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            // Asked every time, but it only interrupts when the answer is that
            // something finished and paid for stops matching this scene.
            const preview = await previewSceneRevisionAction(data);
            if (!preview.success) {
              setSucceeded(false);
              setMessage(preview.error);
              return;
            }
            if (describeSceneSaveImpact(preview.estimate).needsConfirmation) {
              setConfirming(preview.estimate);
              setMessage(null);
              return;
            }
            await save(data);
          } catch {
            setSucceeded(false);
            setMessage(
              "The request could not complete. Your changes are still here; try again.",
            );
          }
        });
      }}
      className="space-y-4"
      onChange={(event) => {
        setConfirming(null);
        const parsed = parseSceneEditorInput(new FormData(event.currentTarget));
        const dirty =
          !parsed.success || hasSceneContentChanged(version, parsed.data);
        setChanged(dirty);
        setCompatibility(
          parsed.success
            ? sceneMediaCompatibility(version, parsed.data)
            : { image: false, audio: false },
        );
        setMessage(null);
        onDirtyChange?.(dirty);
      }}
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
        <SceneSaveBar
          dirty={changed}
          impact={describeSceneSaveState({
            dirty: changed,
            keepsImages: compatibility.image,
            keepsNarration: compatibility.audio,
          })}
          pending={pending}
        />
      ) : null}
      {confirming ? (
        <SceneRevisionConfirmDialog
          estimate={confirming}
          onConfirm={confirmSave}
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          open
          pending={pending}
          summary={describeSceneSaveImpact(confirming)}
        />
      ) : null}
      {message ? (
        <p
          className={
            succeeded ? "text-sm text-emerald-700" : "text-sm text-destructive"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
