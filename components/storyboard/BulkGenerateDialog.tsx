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
import { ManualConfirmationField } from "@/components/budgets/ManualConfirmationField";
import { requiresManualConfirmation } from "@/lib/budgets/budget-settings";
import { estimateBulkSceneImageCostCents } from "@/lib/costs/scene-image-cost";
import type { SceneImageQuality } from "@/lib/scenes/scene-image-view";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmedHighCost, setConfirmedHighCost] = useState(false);

  const estimatedCostCents = useMemo(
    () =>
      estimateBulkSceneImageCostCents({
        sceneCount: sceneIds.length,
        quality,
        size: configuration.defaultSize,
        outputCostMatrix: configuration.outputCostMatrix,
      }),
    [
      configuration.defaultSize,
      configuration.outputCostMatrix,
      quality,
      sceneIds.length,
    ],
  );

  const overBudget = estimatedCostCents > availableBudgetCents;
  const overLimit = sceneIds.length > configuration.maximumImagesPerBatch;
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

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

        <BulkGenerationSummary
          availableBudgetCents={availableBudgetCents}
          estimatedCostCents={estimatedCostCents}
          maximumImagesPerBatch={configuration.maximumImagesPerBatch}
          sceneCount={sceneIds.length}
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
                });
                if (result.success) onOpenChange(false);
                else setError(result.error);
              })
            }
            type="button"
          >
            {pending
              ? "Starting…"
              : `Generate ${sceneIds.length} ${sceneIds.length === 1 ? "scene" : "scenes"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
