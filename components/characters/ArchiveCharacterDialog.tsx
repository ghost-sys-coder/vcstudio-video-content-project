"use client";

import { useState, useTransition } from "react";
import { archiveCharacterAction } from "@/app/(authenticated)/app/characters/actions";
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

export function ArchiveCharacterDialog({
  characterId,
  name,
}: {
  characterId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button variant="destructive" />}>
        Archive character
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {name}?</DialogTitle>
          <DialogDescription>
            Historical scene assignments remain, but this character cannot be
            edited, uploaded to, or newly assigned.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const data = new FormData();
                data.set("characterId", characterId);
                const result = await archiveCharacterAction(data);
                setError(result.error);
              })
            }
            variant="destructive"
          >
            {pending ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
