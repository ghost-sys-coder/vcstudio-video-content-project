"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OutpaintConfirmDialog({
  open,
  onOpenChange,
  estimatedCostCents,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimatedCostCents: number;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a paid outpaint?</DialogTitle>
          <DialogDescription>
            This extends the approved image for this output format using AI
            image editing. Conservative estimate:{" "}
            <strong className="text-foreground">
              {(estimatedCostCents / 100).toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
            </strong>
            . The original approved image will remain unchanged.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={pending} onClick={onConfirm} type="button">
            {pending ? "Starting…" : "Generate outpaint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
