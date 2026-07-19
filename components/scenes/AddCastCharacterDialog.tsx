"use client";

import { useState, useTransition } from "react";
import type { Character } from "@/db/schema";
import { addCastCharacterAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddCastCharacterDialog({
  projectId,
  availableCharacters,
}: {
  projectId: string;
  availableCharacters: Character[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addCharacter(characterId: string) {
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("characterId", characterId);
      const result = await addCastCharacterAction(data);
      setError(result.error);
      if (result.success) setOpen(false);
    });
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Add character
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a character to the cast</DialogTitle>
          <DialogDescription>
            Only active workspace characters not already in the cast are shown.
            Cast characters are matched to scenes by name and used consistently.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {availableCharacters.length ? (
            availableCharacters.map((character) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                key={character.id}
              >
                <span className="text-sm font-medium">{character.name}</span>
                <Button
                  disabled={pending}
                  onClick={() => addCharacter(character.id)}
                  size="sm"
                  variant="outline"
                >
                  Add
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Every active character is already in this project&apos;s cast.
              Create or activate more in the character library.
            </p>
          )}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
