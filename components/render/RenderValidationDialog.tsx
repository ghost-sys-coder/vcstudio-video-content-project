"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RenderActionIssue } from "@/lib/render/render-view";

/**
 * Surfaces the blocking timeline issues that prevented a render so failed
 * scenes are never hidden inside a generic error.
 */
export function RenderValidationDialog({
  open,
  onOpenChange,
  issues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: RenderActionIssue[];
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>The timeline is not ready</DialogTitle>
          <DialogDescription>
            Resolve these issues, then start the render again.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {issues.map((issue, index) => (
            <li
              className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
              key={`${issue.sceneNumber ?? "general"}-${index}`}
            >
              {issue.sceneNumber !== null ? (
                <span className="font-semibold">
                  Scene {issue.sceneNumber}:{" "}
                </span>
              ) : null}
              {issue.message}
            </li>
          ))}
        </ul>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
