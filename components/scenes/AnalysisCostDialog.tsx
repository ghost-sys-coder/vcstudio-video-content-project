"use client";

import { useState, useTransition } from "react";
import { startSceneAnalysisAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { AnalyzeScriptButton } from "@/components/scenes/AnalyzeScriptButton";
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

export function AnalysisCostDialog({
  projectId,
  scriptVersionId,
  estimatedCostCents,
  disabled,
}: {
  projectId: string;
  scriptVersionId: string | null;
  estimatedCostCents: number;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<AnalyzeScriptButton disabled={disabled} />} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm scene analysis</DialogTitle>
          <DialogDescription>
            Estimated OpenAI cost: ${(estimatedCostCents / 100).toFixed(2)}.
            Actual cost is recorded after completion and counts toward the
            project budget.
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
            disabled={pending || !scriptVersionId}
            onClick={() =>
              startTransition(async () => {
                if (!scriptVersionId) return;
                const data = new FormData();
                data.set("projectId", projectId);
                data.set("scriptVersionId", scriptVersionId);
                const result = await startSceneAnalysisAction(data);
                setError(result.error);
                if (result.success) {
                  setOpen(false);
                  window.location.reload();
                }
              })
            }
            type="button"
          >
            {pending ? "Queueing…" : "Confirm and analyze"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
