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
import type { SceneDeletionSummary } from "@/lib/scenes/describe-scene-deletion";

const TONE_CLASSES = {
  neutral: "text-muted-foreground",
  caution: "text-amber-700 dark:text-amber-400",
} as const;

/**
 * The last step before a scene and everything it owns is gone.
 *
 * Every consequence is listed rather than summarised, because two of them are
 * genuinely surprising: the generated images and narration are destroyed with
 * the scene, and the passage of the approved script it narrated stops being
 * covered by anything. The wording comes from `describeSceneDeletion`, so what
 * a person is told matches what will actually happen.
 */
export function DeleteSceneDialog({
  onConfirm,
  onOpenChange,
  open,
  pending,
  summary,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  summary: SceneDeletionSummary;
}) {
  const [lead, ...rest] = summary.lines;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{summary.title}</DialogTitle>
          {lead ? <DialogDescription>{lead.text}</DialogDescription> : null}
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {rest.map((line) => (
            <li className={TONE_CLASSES[line.tone]} key={line.text}>
              {line.text}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep it
          </DialogClose>
          <Button
            disabled={pending || !summary.canDelete}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {pending ? "Deleting…" : summary.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
