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
import { SceneRevisionEstimate } from "@/components/scenes/SceneRevisionEstimate";
import type { SceneSaveImpactSummary } from "@/lib/scenes/describe-scene-save";
import type { SceneRevisionEstimateView } from "@/lib/scenes/scene-revision-view";

/**
 * Shown only when saving would invalidate media that already exists.
 *
 * An edit that destroys nothing never reaches this dialog — it saves on the
 * first click. So everything here is genuinely worth stopping for, and the
 * itemised estimate is the same one the editor used to decide to stop.
 */
export function SceneRevisionConfirmDialog({
  estimate,
  onConfirm,
  onOpenChange,
  open,
  pending,
  summary,
}: {
  estimate: SceneRevisionEstimateView;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  summary: SceneSaveImpactSummary;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{summary.title}</DialogTitle>
          <DialogDescription>{summary.lead}</DialogDescription>
        </DialogHeader>

        <SceneRevisionEstimate estimate={estimate} />

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep editing
          </DialogClose>
          <Button disabled={pending} onClick={onConfirm} type="button">
            {pending ? "Saving…" : summary.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
