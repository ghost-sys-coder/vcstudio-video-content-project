"use client";

import { useMemo, useState, useTransition } from "react";
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
import { BulkGenerationSummary } from "@/components/storyboard/BulkGenerationSummary";
import { ImageSizeMultiSelect } from "@/components/scenes/ImageSizeMultiSelect";
import { ManualConfirmationField } from "@/components/budgets/ManualConfirmationField";
import { requiresManualConfirmation } from "@/lib/budgets/budget-settings";
import { estimateBulkSceneImageCostCents } from "@/lib/costs/scene-image-cost";
import type {
  SceneImageApiSize,
  SceneImageQuality,
} from "@/lib/scenes/scene-image-view";
import type {
  BulkGenerateHandler,
  StoryboardConfigurationView,
} from "@/lib/scenes/storyboard-view";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import { cn } from "@/lib/utils";

export function BulkGenerateDialog({
  open,
  onOpenChange,
  title,
  description,
  sceneIds,
  stylePresets,
  configuration,
  availableBudgetCents,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  sceneIds: string[];
  stylePresets: SceneImageStylePresetView[];
  configuration: StoryboardConfigurationView;
  availableBudgetCents: number;
  onGenerate: BulkGenerateHandler;
}) {
  const defaultPresetId =
    stylePresets.find((preset) => preset.isDefault)?.versionId ??
    stylePresets[0]?.versionId ??
    "";
  const [stylePresetVersionId, setStylePresetVersionId] =
    useState(defaultPresetId);
  const [quality, setQuality] = useState<SceneImageQuality>(
    configuration.draftQuality,
  );
  const [sizes, setSizes] = useState<SceneImageApiSize[]>([
    configuration.defaultSize,
  ]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmedHighCost, setConfirmedHighCost] = useState(false);

  const requestedImageCount = sceneIds.length * sizes.length;
  const estimatedCostCents = useMemo(
    () =>
      estimateBulkSceneImageCostCents({
        sceneCount: sceneIds.length,
        quality,
        sizes,
        outputCostMatrix: configuration.outputCostMatrix,
      }),
    [configuration.outputCostMatrix, quality, sceneIds.length, sizes],
  );

  const overBudget = estimatedCostCents > availableBudgetCents;
  const overLimit = requestedImageCount > configuration.maximumImagesPerBatch;
  const needsConfirmation = requiresManualConfirmation(
    estimatedCostCents,
    configuration.manualConfirmationThresholdCents,
  );
  const canConfirm =
    sceneIds.length > 0 &&
    stylePresetVersionId !== "" &&
    !overBudget &&
    !overLimit &&
    (!needsConfirmation || confirmedHighCost) &&
    !pending;

  return (
    // Laid out as a column whose middle scrolls, so the cost summary and the
    // confirm button stay on screen while the options above them scroll — on a
    // short viewport this dialog is otherwise tall enough to push its own
    // actions out of reach.
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="bulk-style-preset">
              Style preset
            </label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              id="bulk-style-preset"
              onChange={(event) => setStylePresetVersionId(event.target.value)}
              value={stylePresetVersionId}
            >
              {stylePresets.map((preset) => (
                <option key={preset.versionId} value={preset.versionId}>
                  {preset.name} v{preset.version}
                  {preset.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quality</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [configuration.draftQuality, "Draft", "Lower cost"],
                  [configuration.finalQuality, "Final", "Higher quality"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition",
                    quality === value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-input hover:bg-muted",
                  )}
                  key={value}
                  onClick={() => setQuality(value)}
                  type="button"
                >
                  <span className="block font-medium capitalize">{label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <ImageSizeMultiSelect
            disabled={pending}
            id="bulk-image-sizes"
            onChange={setSizes}
            value={sizes}
          />
        </div>

        {/* Pinned: what it costs and whether it can proceed must stay visible
            alongside the button that spends the money. */}
        <div className="shrink-0 space-y-4 border-t border-border pt-4">
          <BulkGenerationSummary
            availableBudgetCents={availableBudgetCents}
            estimatedCostCents={estimatedCostCents}
            maximumImagesPerBatch={configuration.maximumImagesPerBatch}
            requestedImageCount={requestedImageCount}
            sceneCount={sceneIds.length}
            sizeCount={sizes.length}
          />

          <ManualConfirmationField
            checked={confirmedHighCost}
            disabled={pending}
            estimatedCostCents={estimatedCostCents}
            onChange={setConfirmedHighCost}
            thresholdCents={configuration.manualConfirmationThresholdCents}
          />

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
                  const result = await onGenerate({
                    sceneIds,
                    stylePresetVersionId,
                    quality,
                    sizes,
                  });
                  if (result.success) onOpenChange(false);
                  else setError(result.error);
                })
              }
              type="button"
            >
              {pending
                ? "Starting…"
                : `Generate ${requestedImageCount} ${requestedImageCount === 1 ? "image" : "images"}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
