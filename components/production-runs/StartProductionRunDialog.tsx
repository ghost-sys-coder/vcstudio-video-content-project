"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon } from "lucide-react";
import { startProductionRunAction } from "@/app/(authenticated)/app/projects/[projectId]/actions";
import { ProductionRunStageModeField } from "@/components/production-runs/ProductionRunStageModeField";
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
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";

export interface VoicePresetOption {
  id: string;
  name: string;
  isDefault: boolean;
}

/**
 * Starts an unattended run.
 *
 * The dialog states what the run will decide on its own and the most it may
 * spend before anything starts, because a run is money spent while nobody is
 * watching. The release stage is always a review and is said to be.
 */
export function StartProductionRunDialog({
  defaultMaximumCostCents,
  projectBudgetCents,
  projectId,
  voicePresets,
}: {
  defaultMaximumCostCents: number;
  projectBudgetCents: number;
  projectId: string;
  voicePresets: VoicePresetOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaultDollars = (
    Math.min(defaultMaximumCostCents, projectBudgetCents) / 100
  ).toFixed(2);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>
        <PlayIcon aria-hidden className="size-4" />
        Run production
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              const result = await startProductionRunAction(data);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <input name="projectId" type="hidden" value={projectId} />
          <DialogHeader>
            <DialogTitle>Run production without you</DialogTitle>
            <DialogDescription>
              The run writes or approves the script, plans scenes, generates
              images and narration, renders, then assembles a release package
              and stops for your review. Each stage is checked before the run
              accepts it; anything that fails a check stops the run and waits.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <ProductionRunStageModeField
              defaultValue="auto"
              description="Approves a brief-driven or drafted script when its length fits the brief."
              label="Script"
              name="scriptMode"
            />
            <ProductionRunStageModeField
              defaultValue="auto"
              description="Approves the scene plan when every scene has narration and a visual."
              label="Scenes"
              name="scenesMode"
            />
            <ProductionRunStageModeField
              defaultValue="auto"
              description="Approves images that stored at the requested size. It cannot see the picture; spot-check later."
              label="Images"
              name="imagesMode"
            />
            <ProductionRunStageModeField
              defaultValue="auto"
              description="Approves clips whose measured length fits their words and that are not mostly silence."
              label="Narration"
              name="audioMode"
            />
            <ProductionRunStageModeField
              defaultValue="auto"
              description="Moves on to the release package once the render succeeds."
              label="Render"
              name="renderMode"
            />

            <div className="grid gap-1.5">
              <Label htmlFor="production-run-quality">Image quality</Label>
              <FormSelect
                defaultValue="medium"
                id="production-run-quality"
                name="imageQuality"
              >
                <SelectItem value="low">Draft (cheapest)</SelectItem>
                <SelectItem value="medium">Final</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </FormSelect>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="production-run-voice">Voice</Label>
              <FormSelect
                defaultValue={
                  voicePresets.find((preset) => preset.isDefault)?.id ??
                  voicePresets[0]?.id ??
                  ""
                }
                id="production-run-voice"
                name="voicePresetId"
              >
                {voicePresets.length === 0 ? (
                  <SelectItem value="">No voice presets yet</SelectItem>
                ) : (
                  voicePresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                      {preset.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))
                )}
              </FormSelect>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="production-run-ceiling">
                Most this run may spend (USD)
              </Label>
              <Input
                defaultValue={defaultDollars}
                id="production-run-ceiling"
                inputMode="decimal"
                max={(projectBudgetCents / 100).toFixed(2)}
                min="0"
                name="maximumCostDollars"
                step="0.01"
                type="number"
              />
              <p className="text-xs text-muted-foreground">
                Inside the project budget of $
                {(projectBudgetCents / 100).toFixed(2)}. Each stage still
                reserves against the workspace budgets as usual.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="production-run-retry">If a stage fails</Label>
              <FormSelect
                defaultValue="true"
                id="production-run-retry"
                name="retryFailedStages"
              >
                <SelectItem value="true">Try once more, then stop</SelectItem>
                <SelectItem value="false">Stop immediately</SelectItem>
              </FormSelect>
            </div>

            <p className="text-sm text-muted-foreground">
              The release package is always left for you: nothing is confirmed,
              scheduled or published by a run.
            </p>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={pending || voicePresets.length === 0}
              type="submit"
            >
              {pending ? "Starting…" : "Start run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
