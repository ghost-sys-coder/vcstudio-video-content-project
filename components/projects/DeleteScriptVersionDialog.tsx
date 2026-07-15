"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteScriptVersionAction } from "@/app/(authenticated)/app/projects/actions";
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

export function DeleteScriptVersionDialog({
  projectId,
  versionId,
  versionNumber,
  disabled,
}: {
  projectId: string;
  versionId: string;
  versionNumber: number;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={`Delete script version ${versionNumber}`}
            disabled={disabled}
            size="icon-sm"
            variant="destructive"
          />
        }
      >
        <Trash2 aria-hidden="true" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete version {versionNumber}?</DialogTitle>
          <DialogDescription>
            This version will be removed from the project history. Approved
            versions and versions used by scene analysis cannot be deleted.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const data = new FormData();
                data.set("projectId", projectId);
                data.set("versionId", versionId);
                const result = await deleteScriptVersionAction(data);
                if (result.success) {
                  setOpen(false);
                  window.location.reload();
                } else setError(result.error);
              })
            }
            type="button"
            variant="destructive"
          >
            {pending ? "Deleting…" : "Delete version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
