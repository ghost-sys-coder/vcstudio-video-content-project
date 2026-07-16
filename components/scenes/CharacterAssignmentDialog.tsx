"use client";

import { useState, useTransition } from "react";
import type { Character } from "@/db/schema";
import { assignSceneCharactersAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
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

export function CharacterAssignmentDialog({
  projectId,
  sceneId,
  sceneVersionId,
  characters,
  assignedCharacterIds,
}: {
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  characters: Character[];
  assignedCharacterIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set(assignedCharacterIds));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setSelected(new Set(assignedCharacterIds));
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Assign characters
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign scene characters</DialogTitle>
          <DialogDescription>
            Only active workspace characters are available for new assignments.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {characters.length ? (
            characters.map((character) => (
              <label
                className="flex items-center gap-3 rounded-lg border p-3"
                key={character.id}
              >
                <input
                  checked={selected.has(character.id)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(character.id);
                      else next.delete(character.id);
                      return next;
                    })
                  }
                  type="checkbox"
                />
                <span className="text-sm font-medium">{character.name}</span>
              </label>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Activate a character in the library before assigning it.
            </p>
          )}
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
                for (const id of selected) data.append("characterIds", id);
                const result = await assignSceneCharactersAction(data);
                setError(result.error);
                if (result.success) setOpen(false);
              })
            }
          >
            {pending ? "Saving…" : "Save assignments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
