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
import type { ReframeConfirmation } from "@/lib/reframe/reframe-confirmation";

const TONE_CLASSES = {
  neutral: "text-muted-foreground",
  caution: "text-amber-700 dark:text-amber-400",
  blocking: "text-destructive",
} as const;

/**
 * The last step before a reframe spends anything.
 *
 * Every consequence is listed rather than summarised: which scenes get a new
 * image, which lose their edges to a crop, which are blocking the job, and what
 * the whole thing costs. The wording comes from `describeReframeConfirmation`
 * so it always matches the plan the server actually made.
 */
export function ReframeConfirmDialog({
  confirmation,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: {
  confirmation: ReframeConfirmation;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}) {
  const [lead, ...rest] = confirmation.lines;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmation.title}</DialogTitle>
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
            Cancel
          </DialogClose>
          <Button
            disabled={pending || !confirmation.canConfirm}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "Starting…" : confirmation.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
