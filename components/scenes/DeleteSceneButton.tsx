"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteSceneDialog } from "@/components/scenes/DeleteSceneDialog";
import { deleteSceneAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import {
  describeSceneDeletion,
  type SceneDeletionInput,
} from "@/lib/scenes/describe-scene-deletion";

/**
 * Deletes one scene, after saying what that costs.
 *
 * The counts it warns about are passed in from the server rather than guessed
 * here, so the dialog describes the scene as it actually stands.
 */
export function DeleteSceneButton({
  projectId,
  sceneId,
  deletion,
}: {
  projectId: string;
  sceneId: string;
  deletion: SceneDeletionInput;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = describeSceneDeletion(deletion);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("sceneId", sceneId);
      const result = await deleteSceneAction(data);
      if (!result.success) {
        setError(result.error);
        setOpen(false);
        return;
      }
      setOpen(false);
      // Scene numbers moved, so anything showing them is now wrong.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        disabled={pending}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="destructive"
      >
        <Trash2Icon aria-hidden className="size-4" />
        Delete scene
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <DeleteSceneDialog
        onConfirm={confirm}
        onOpenChange={setOpen}
        open={open}
        pending={pending}
        summary={summary}
      />
    </>
  );
}
