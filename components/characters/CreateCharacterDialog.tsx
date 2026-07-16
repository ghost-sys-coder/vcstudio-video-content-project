"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { CharacterForm } from "@/components/characters/CharacterForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateCharacterDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" /> Create character
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create character</DialogTitle>
          <DialogDescription>
            Define a reusable identity before adding visual references.
          </DialogDescription>
        </DialogHeader>
        <CharacterForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
