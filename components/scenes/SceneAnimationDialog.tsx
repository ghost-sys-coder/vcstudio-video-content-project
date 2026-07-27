"use client";

import { useState, useTransition } from "react";
import type { Character } from "@/db/schema";
import {
  clearSceneAnimationDirectionAction,
  setSceneAnimationDirectionAction,
} from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const NONE_VALUE = "__none__";

export function SceneAnimationDialog({
  projectId,
  sceneId,
  sceneVersionId,
  animationReadyCharacters,
  currentCharacterId,
}: {
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  animationReadyCharacters: Character[];
  currentCharacterId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentCharacterId ?? NONE_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setSelected(currentCharacterId ?? NONE_VALUE);
        setError(null);
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        {currentCharacterId ? "Change animated character" : "Animate scene"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Animate this scene</DialogTitle>
          <DialogDescription>
            Replace the static scene image with a rigged character that blinks
            and lip-syncs to the narration audio.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          <label className="flex items-center gap-3 rounded-lg border p-3">
            <input
              checked={selected === NONE_VALUE}
              name="scene-animation-character"
              onChange={() => setSelected(NONE_VALUE)}
              type="radio"
            />
            <span className="text-sm font-medium">
              None — use the static scene image
            </span>
          </label>
          {animationReadyCharacters.map((character) => (
            <label
              className="flex items-center gap-3 rounded-lg border p-3"
              key={character.id}
            >
              <input
                checked={selected === character.id}
                name="scene-animation-character"
                onChange={() => setSelected(character.id)}
                type="radio"
              />
              <span className="text-sm font-medium">{character.name}</span>
            </label>
          ))}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const data = new FormData();
                data.set("projectId", projectId);
                data.set("sceneId", sceneId);
                data.set("sceneVersionId", sceneVersionId);
                const result =
                  selected === NONE_VALUE
                    ? await clearSceneAnimationDirectionAction(data)
                    : await (async () => {
                        data.set("characterId", selected);
                        return setSceneAnimationDirectionAction(data);
                      })();
                setError(result.error);
                if (result.success) setOpen(false);
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
