"use client";

import { useState, useTransition } from "react";
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
import { formatUsdCents } from "@/lib/format/currency";
import type { SceneAudioActionResult } from "@/lib/audio/audio-view";

export function AudioGenerationDialog({
  open,
  onOpenChange,
  title,
  description,
  sceneCount,
  estimatedCostCents,
  availableBudgetCents,
  maximumScenesPerBatch,
  voicePresetName,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  sceneCount: number;
  estimatedCostCents: number;
  availableBudgetCents: number;
  maximumScenesPerBatch: number;
  voicePresetName: string;
  confirmLabel: string;
  onConfirm: () => Promise<SceneAudioActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const overBudget = estimatedCostCents > availableBudgetCents;
  const overLimit = sceneCount > maximumScenesPerBatch;
  const canConfirm = sceneCount > 0 && !overBudget && !overLimit && !pending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg bg-muted/40 p-3 text-sm ring-1 ring-inset ring-foreground/10">
          <dl className="space-y-1.5">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Voice</dt>
              <dd>{voicePresetName}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Scenes</dt>
              <dd className="font-mono tabular-nums">{sceneCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Estimated cost</dt>
              <dd className="font-mono tabular-nums">
                {formatUsdCents(estimatedCostCents)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Remaining budget</dt>
              <dd className="font-mono tabular-nums">
                {formatUsdCents(availableBudgetCents)}
              </dd>
            </div>
          </dl>
          {overLimit ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              Generate at most {maximumScenesPerBatch} scenes at once.
            </p>
          ) : overBudget ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              This would exceed the available budget.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Each scene&rsquo;s narration audio becomes the authoritative
              source for its duration in the project timeline.
            </p>
          )}
        </div>

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
            disabled={!canConfirm}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await onConfirm();
                if (result.success) onOpenChange(false);
                else setError(result.error);
              })
            }
            type="button"
          >
            {pending ? "Starting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
