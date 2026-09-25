"use client";

import { useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { createManualSceneAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { SceneContentFields } from "@/components/scenes/SceneContentFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SceneContent } from "@/lib/schemas/scene";

const EMPTY_SCENE: SceneContent = {
  narrationText: "",
  visualDescription: "",
  locationDescription: "",
  actionDescription: "",
  cameraShot: "",
  cameraAngle: "",
  cameraMotion: "",
  emotionalTone: "",
  characterNames: [],
  propNames: [],
  continuityNotes: "",
  estimatedDurationMilliseconds: 10000,
};

export function CreateSceneDialog({
  projectId,
  firstScene = false,
}: {
  projectId: string;
  firstScene?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={<Button variant={firstScene ? "default" : "outline"} />}
      >
        <PlusIcon aria-hidden className="size-4" />
        {firstScene ? "Create your first scene" : "Add scene"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create scene</DialogTitle>
          <DialogDescription>
            Write or paste the narration and visual brief. This saves a draft
            scene without using AI or requiring a script. You can edit it and
            add images after creation.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(async () => {
              try {
                const result = await createManualSceneAction(data);
                if (!result.success || !result.sceneNumber) {
                  setError(result.error ?? "The scene could not be created.");
                  return;
                }
                window.location.assign(
                  `/app/projects/${projectId}/scenes?scene=${result.sceneNumber}`,
                );
              } catch {
                setError(
                  "The request could not complete. Your draft is still here; try again.",
                );
              }
            });
          }}
        >
          <input name="projectId" type="hidden" value={projectId} />
          <SceneContentFields
            content={EMPTY_SCENE}
            disabled={pending}
            idPrefix="new-scene"
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={pending} type="submit">
              {pending ? "Creating…" : "Create scene"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
