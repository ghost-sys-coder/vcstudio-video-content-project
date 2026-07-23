"use client";

import { useState, useTransition } from "react";
import type {
  SceneImageActionResult,
  SceneImageApiSize,
} from "@/lib/scenes/scene-image-view";
import { formatUsdCents } from "@/lib/format/currency";
import { getSceneImageSizeLabel } from "@/lib/scenes/scene-image-size-options";
import { runSceneImageAction } from "@/lib/scenes/run-scene-image-action";
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

export function GenerateSceneImageButton({
  disabled,
  disabledReason,
  estimatedCostCents,
  model,
  qualityLabel,
  sizes,
  stylePresetLabel,
  referenceCount,
  onConfirm,
}: {
  disabled: boolean;
  disabledReason?: string;
  estimatedCostCents: number;
  model: string;
  qualityLabel: string;
  sizes: SceneImageApiSize[];
  stylePresetLabel: string;
  referenceCount: number;
  onConfirm: (requestNonce: string) => Promise<SceneImageActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requestNonce, setRequestNonce] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Dialog
        onOpenChange={(nextOpen) => {
          if (nextOpen && !open) setRequestNonce(crypto.randomUUID());
          setOpen(nextOpen);
          if (nextOpen) setError(null);
        }}
        open={open}
      >
        <DialogTrigger
          disabled={disabled}
          render={<Button disabled={disabled} type="button" />}
        >
          Review and generate
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm paid image generation
              {sizes.length > 1 ? ` — ${sizes.length} images` : ""}
            </DialogTitle>
            <DialogDescription>
              {sizes.length > 1
                ? "Each selected size is an independent, separately-billed generation. Every confirmation creates new generation versions; older results remain available."
                : "Each confirmation creates a new generation version and a new billable provider request. Older results remain available."}
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
            <dt className="text-muted-foreground">Total estimate</dt>
            <dd className="text-right font-semibold tabular-nums">
              {formatUsdCents(estimatedCostCents)}
            </dd>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="text-right">{model}</dd>
            <dt className="text-muted-foreground">Style</dt>
            <dd className="text-right">{stylePresetLabel}</dd>
            <dt className="text-muted-foreground">Quality</dt>
            <dd className="text-right">{qualityLabel}</dd>
            <dt className="text-muted-foreground">Sizes</dt>
            <dd className="text-right">
              {sizes.map((size) => getSceneImageSizeLabel(size)).join(", ")}
            </dd>
            <dt className="text-muted-foreground">References</dt>
            <dd className="text-right">{referenceCount}</dd>
          </dl>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={pending || !requestNonce}
              onClick={() =>
                startTransition(async () => {
                  if (!requestNonce) return;
                  setError(null);
                  const result = await runSceneImageAction(
                    () => onConfirm(requestNonce),
                    "The generation could not be started. No new request should be submitted until the current status is refreshed.",
                  );
                  setError(result.error);
                  if (result.success) setOpen(false);
                })
              }
              type="button"
            >
              {pending
                ? "Creating generation..."
                : sizes.length > 1
                  ? `Confirm ${sizes.length} paid generations`
                  : "Confirm paid generation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
