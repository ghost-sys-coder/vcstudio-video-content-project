"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  approveGeneratedImageAction,
  rejectGeneratedImageAction,
} from "@/app/(authenticated)/app/projects/[projectId]/scenes/image-actions";
import {
  cancelSceneImageBatchAction,
  startBulkSceneImageGenerationAction,
} from "@/app/(authenticated)/app/projects/[projectId]/storyboard/actions";
import { BulkGenerationProgress } from "@/components/storyboard/BulkGenerationProgress";
import { StoryboardEmptyState } from "@/components/storyboard/StoryboardEmptyState";
import { StoryboardGrid } from "@/components/storyboard/StoryboardGrid";
import { StoryboardToolbar } from "@/components/storyboard/StoryboardToolbar";
import { isActiveImageGenerationStatus } from "@/lib/domain/bulk-scene-image";
import { isSceneSelectableForBulk } from "@/lib/scenes/scene-image-eligibility";
import {
  filterStoryboardScenes,
  sceneMatchesStoryboardFilter,
  STORYBOARD_FILTERS,
  type StoryboardFilter,
} from "@/lib/scenes/storyboard-filter";
import type {
  BulkGenerateInput,
  BulkSceneImageActionResult,
  StoryboardView,
} from "@/lib/scenes/storyboard-view";
import { storyboardResponseSchema } from "@/lib/schemas/storyboard";

const POLL_INTERVAL_MS = 4_000;

export function Storyboard({
  projectId,
  initialData,
  canGenerate,
  canReview,
}: {
  projectId: string;
  initialData: StoryboardView;
  canGenerate: boolean;
  canReview: boolean;
}) {
  const [data, setData] = useState<StoryboardView>(initialData);
  const [filter, setFilter] = useState<StoryboardFilter>("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch(`/api/projects/${projectId}/storyboard`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      const parsed = storyboardResponseSchema.safeParse(payload);
      if (response.ok && parsed.success && parsed.data.success)
        setData(parsed.data.data);
    } finally {
      refreshing.current = false;
    }
  }, [projectId]);

  const hasActiveWork = useMemo(
    () =>
      data.latestBatch?.displayStatus === "processing" ||
      data.scenes.some(
        (scene) =>
          scene.latestStatus !== null &&
          isActiveImageGenerationStatus(scene.latestStatus),
      ),
    [data],
  );

  useEffect(() => {
    if (!hasActiveWork) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasActiveWork, refresh]);

  const eligibleSceneIds = useMemo(
    () =>
      data.scenes
        .filter((scene) => scene.eligibility === "eligible")
        .map((scene) => scene.sceneId),
    [data.scenes],
  );

  const filterCounts = useMemo(() => {
    const counts = {} as Record<StoryboardFilter, number>;
    for (const definition of STORYBOARD_FILTERS)
      counts[definition.value] = data.scenes.filter((scene) =>
        sceneMatchesStoryboardFilter(scene, definition.value),
      ).length;
    return counts;
  }, [data.scenes]);

  const filteredScenes = useMemo(
    () => filterStoryboardScenes(data.scenes, filter),
    [data.scenes, filter],
  );

  const approvableGenerationIds = useMemo(
    () =>
      data.scenes
        .filter(
          (scene) =>
            selected.has(scene.sceneId) &&
            scene.latestStatus === "succeeded" &&
            scene.latestReviewStatus === "pending" &&
            scene.latestGenerationId !== null,
        )
        .map((scene) => scene.latestGenerationId as string),
    [data.scenes, selected],
  );

  const toggleSelect = useCallback((sceneId: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(sceneId);
      else next.delete(sceneId);
      return next;
    });
  }, []);

  const selectAllEligible = useCallback(() => {
    setSelected(new Set(eligibleSceneIds));
  }, [eligibleSceneIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const handleGenerate = useCallback(
    async (input: BulkGenerateInput): Promise<BulkSceneImageActionResult> => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("stylePresetVersionId", input.stylePresetVersionId);
      formData.set("quality", input.quality);
      formData.set("requestNonce", crypto.randomUUID());
      input.sceneIds.forEach((id) => formData.append("sceneIds", id));
      const result = await startBulkSceneImageGenerationAction(formData);
      if (result.success) {
        clearSelection();
        await refresh();
      }
      return result;
    },
    [clearSelection, projectId, refresh],
  );

  const runReview = useCallback(
    async (
      action: (formData: FormData) => Promise<BulkSceneImageActionResult>,
      generationId: string,
    ): Promise<BulkSceneImageActionResult> => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("generationId", generationId);
      const result = await action(formData);
      if (result.success) await refresh();
      return result;
    },
    [projectId, refresh],
  );

  const handleApproveSelected =
    useCallback(async (): Promise<BulkSceneImageActionResult> => {
      let failure: string | null = null;
      for (const generationId of approvableGenerationIds) {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("generationId", generationId);
        const result = await approveGeneratedImageAction(formData);
        if (!result.success) failure = result.error;
      }
      clearSelection();
      await refresh();
      return { success: failure === null, error: failure };
    }, [approvableGenerationIds, clearSelection, projectId, refresh]);

  const handleCancelBatch =
    useCallback(async (): Promise<BulkSceneImageActionResult> => {
      if (!data.latestBatch)
        return { success: false, error: "There is no batch to cancel." };
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("batchId", data.latestBatch.id);
      const result = await cancelSceneImageBatchAction(formData);
      if (result.success) await refresh();
      return result;
    }, [data.latestBatch, projectId, refresh]);

  if (data.scenes.length === 0) return <StoryboardEmptyState />;

  const selectableSelected = [...selected].filter((sceneId) =>
    data.scenes.some(
      (scene) =>
        scene.sceneId === sceneId &&
        isSceneSelectableForBulk(scene.eligibility),
    ),
  );

  return (
    <div className="space-y-5">
      {data.latestBatch ? (
        <BulkGenerationProgress
          batch={data.latestBatch}
          canCancel={canGenerate}
          onCancel={handleCancelBatch}
        />
      ) : null}

      <StoryboardToolbar
        approvableCount={approvableGenerationIds.length}
        availableBudgetCents={data.availableBudgetCents}
        canGenerate={canGenerate && data.configuration.enabled}
        canReview={canReview}
        configuration={data.configuration}
        eligibleSceneIds={eligibleSceneIds}
        filter={filter}
        filterCounts={filterCounts}
        onApproveSelected={handleApproveSelected}
        onClearSelection={clearSelection}
        onFilterChange={setFilter}
        onGenerate={handleGenerate}
        onSelectAllEligible={selectAllEligible}
        selectedSceneIds={selectableSelected}
        stylePresets={data.stylePresets}
      />

      <StoryboardGrid
        availableBudgetCents={data.availableBudgetCents}
        canGenerate={canGenerate && data.configuration.enabled}
        canReview={canReview}
        configuration={data.configuration}
        onApproveScene={(generationId) =>
          runReview(approveGeneratedImageAction, generationId)
        }
        onGenerate={handleGenerate}
        onRejectScene={(generationId) =>
          runReview(rejectGeneratedImageAction, generationId)
        }
        onToggleSelect={toggleSelect}
        scenes={filteredScenes}
        selectedSceneIds={selected}
        stylePresets={data.stylePresets}
      />
    </div>
  );
}
