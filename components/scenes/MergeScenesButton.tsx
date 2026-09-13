"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MergeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MergeScenesDialog } from "@/components/scenes/MergeScenesDialog";
import { mergeScenesAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { describeSceneMerge } from "@/lib/scenes/describe-scene-merge";
import type { SceneMergeNeighbour } from "@/lib/scenes/scene-merge-neighbours";

/**
 * Merges this scene with a neighbour, after saying what that costs.
 *
 * Hidden rather than disabled when the scene has no neighbour, because a lone
 * scene has nothing to merge with and an explanation would outweigh the action.
 */
export function MergeScenesButton({
  hasApprovedImages,
  hasGeneratedWork,
  neighbours,
  projectId,
  sceneId,
  sceneNumber,
  totalSceneCount,
}: {
  /** True when this scene has approved images of its own. */
  hasApprovedImages: boolean;
  /** True when anything was generated for this scene. */
  hasGeneratedWork: boolean;
  neighbours: SceneMergeNeighbour[];
  projectId: string;
  sceneId: string;
  sceneNumber: number;
  totalSceneCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [neighbourId, setNeighbourId] = useState<string | null>(
    neighbours[0]?.sceneId ?? null,
  );
  const [survivorIsThisScene, setSurvivorIsThisScene] = useState(true);

  if (neighbours.length === 0) return null;

  const neighbour =
    neighbours.find((one) => one.sceneId === neighbourId) ?? null;

  const summary = neighbour
    ? describeSceneMerge({
        survivorSceneNumber: survivorIsThisScene
          ? sceneNumber
          : neighbour.sceneNumber,
        absorbedSceneNumber: survivorIsThisScene
          ? neighbour.sceneNumber
          : sceneNumber,
        absorbedHasGeneratedWork: survivorIsThisScene
          ? neighbour.hasGeneratedWork
          : hasGeneratedWork,
        survivorHasApprovedImages: survivorIsThisScene
          ? hasApprovedImages
          : neighbour.hasApprovedImages,
        totalSceneCount,
      })
    : null;

  function confirm() {
    if (!neighbour) return;
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set(
        "survivorSceneId",
        survivorIsThisScene ? sceneId : neighbour!.sceneId,
      );
      data.set(
        "absorbedSceneId",
        survivorIsThisScene ? neighbour!.sceneId : sceneId,
      );
      const result = await mergeScenesAction(data);
      if (!result.success) {
        setError(result.error);
        setOpen(false);
        return;
      }
      setOpen(false);
      // Scene numbers moved and one scene is gone, so anything showing them is
      // now wrong.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        disabled={pending}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <MergeIcon aria-hidden className="size-4" />
        Merge
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <MergeScenesDialog
        neighbours={neighbours}
        onConfirm={confirm}
        onOpenChange={setOpen}
        onSelectNeighbour={setNeighbourId}
        onSelectSurvivor={setSurvivorIsThisScene}
        open={open}
        pending={pending}
        sceneNumber={sceneNumber}
        selectedNeighbourId={neighbourId}
        summary={summary}
        survivorIsThisScene={survivorIsThisScene}
      />
    </>
  );
}
