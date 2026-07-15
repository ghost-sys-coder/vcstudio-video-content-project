"use client";

import { useState, useTransition } from "react";
import { approveAllScenesAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
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

export function ApproveAllScenesDialog({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button disabled={disabled} variant="outline" />}>
        Approve all scenes
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve every scene?</DialogTitle>
          <DialogDescription>
            This marks every current scene version as approved for the next
            production phase.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const data = new FormData();
                data.set("projectId", projectId);
                const result = await approveAllScenesAction(data);
                setError(result.error);
                if (result.success) {
                  setOpen(false);
                  window.location.reload();
                }
              })
            }
            type="button"
          >
            {pending ? "Approving…" : "Approve all"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
