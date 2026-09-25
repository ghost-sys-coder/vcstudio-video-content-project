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
import { SceneContentFields } from "@/components/scenes/SceneContentFields";
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
      <SceneContentFields
        content={version}
        disabled={!canEdit || pending}
        idPrefix={`scene-${scene.id}`}
      />
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
