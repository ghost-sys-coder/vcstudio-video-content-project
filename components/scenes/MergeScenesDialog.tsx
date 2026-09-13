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
import { Label } from "@/components/ui/label";
import type { SceneMergeSummary } from "@/lib/scenes/describe-scene-merge";
import type { SceneMergeNeighbour } from "@/lib/scenes/scene-merge-neighbours";

const TONE_CLASSES = {
  neutral: "text-muted-foreground",
  caution: "text-amber-700 dark:text-amber-400",
} as const;

/**
 * Chooses which neighbour to merge with, and which of the two scenes lives on.
 *
 * Both choices are offered rather than assumed, because between them they decide
 * which scene's approved images survive — the only part of a merge that is
 * expensive to get wrong. Merging in the other direction is how a creator keeps
 * the *later* scene's pictures, and nothing else in the result changes: the
 * narration still joins in script order and the merged scene still lands on the
 * earlier number.
 */
export function MergeScenesDialog({
  neighbours,
  onConfirm,
  onOpenChange,
  onSelectNeighbour,
  onSelectSurvivor,
  open,
  pending,
  sceneNumber,
  selectedNeighbourId,
  summary,
  survivorIsThisScene,
}: {
  neighbours: SceneMergeNeighbour[];
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onSelectNeighbour: (sceneId: string) => void;
  onSelectSurvivor: (thisScene: boolean) => void;
  open: boolean;
  pending: boolean;
  sceneNumber: number;
  selectedNeighbourId: string | null;
  summary: SceneMergeSummary | null;
  survivorIsThisScene: boolean;
}) {
  const selected =
    neighbours.find((one) => one.sceneId === selectedNeighbourId) ?? null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {summary?.title ?? `Merge scene ${sceneNumber}`}
          </DialogTitle>
          <DialogDescription>
            Two scenes become one. Only neighbours can be merged, because that
            is what keeps the approved script narrated once and in order.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Merge with</legend>
          {neighbours.map((neighbour) => (
            <Label
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm font-normal has-checked:border-primary has-checked:bg-primary/5"
              key={neighbour.sceneId}
            >
              <input
                checked={selectedNeighbourId === neighbour.sceneId}
                className="mt-0.5"
                name={`merge-target-${sceneNumber}`}
                onChange={() => onSelectNeighbour(neighbour.sceneId)}
                type="radio"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  Scene {neighbour.sceneNumber}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                  {neighbour.narrationPreview}
                </span>
              </span>
            </Label>
          ))}
        </fieldset>

        {selected ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Keep the visuals and images from
            </legend>
            {[
              { thisScene: true, number: sceneNumber },
              { thisScene: false, number: selected.sceneNumber },
            ].map((option) => (
              <Label
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm font-normal has-checked:border-primary has-checked:bg-primary/5"
                key={option.number}
              >
                <input
                  checked={survivorIsThisScene === option.thisScene}
                  name={`merge-survivor-${sceneNumber}`}
                  onChange={() => onSelectSurvivor(option.thisScene)}
                  type="radio"
                />
                <span>Scene {option.number}</span>
              </Label>
            ))}
          </fieldset>
        ) : null}

        {summary ? (
          <ul className="space-y-2 text-sm">
            {summary.lines.map((line) => (
              <li className={TONE_CLASSES[line.tone]} key={line.text}>
                {line.text}
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending || !summary}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {pending ? "Merging…" : (summary?.confirmLabel ?? "Merge scenes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
