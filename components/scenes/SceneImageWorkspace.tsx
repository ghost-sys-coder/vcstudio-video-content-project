"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Character, Scene, SceneVersion } from "@/db/schema";
import {
  approveGeneratedImageAction,
  reconcileSceneImageGenerationAction,
  rejectGeneratedImageAction,
  startSceneImageGenerationAction,
} from "@/app/(authenticated)/app/projects/[projectId]/scenes/image-actions";
import { SceneImagePanel } from "@/components/scenes/SceneImagePanel";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { sceneImageDetailsResponseSchema } from "@/lib/schemas/scene-image-details";
import { createSceneImagePromptPreview } from "@/lib/scenes/scene-image-prompt";
import type {
  SceneImageActionResult,
  SceneImageDetailsView,
  SceneImageGenerationRequest,
  SceneImageSelection,
} from "@/lib/scenes/scene-image-view";

function appendReferenceIds(formData: FormData, ids: string[]): void {
  ids.forEach((id) => formData.append("referenceAssetIds", id));
}

export function SceneImageWorkspace({
  projectAspectRatio,
  scene,
  sceneVersion,
  assignedCharacters,
  canGenerate,
  canReview,
}: {
  projectAspectRatio: "16:9" | "9:16" | "1:1";
  scene: Scene;
  sceneVersion: SceneVersion;
  assignedCharacters: Character[];
  canGenerate: boolean;
  canReview: boolean;
}) {
  const [details, setDetails] = useState<SceneImageDetailsView | null>(null);
  const [selection, setSelection] = useState<SceneImageSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchDetails = useCallback(async (): Promise<SceneImageDetailsView> => {
    const response = await fetch(
      `/api/projects/${scene.projectId}/scenes/${scene.id}/images?sceneVersionId=${sceneVersion.id}`,
      { cache: "no-store" },
    );
    const payload: unknown = await response.json();
    const parsed = sceneImageDetailsResponseSchema.safeParse(payload);
    if (!response.ok || !parsed.success || !parsed.data.success)
      throw new Error(
        parsed.success && !parsed.data.success
          ? parsed.data.error
          : "Scene image details could not be loaded.",
      );
    return parsed.data.data;
  }, [scene.id, scene.projectId, sceneVersion.id]);

  const applyDetails = useCallback((nextDetails: SceneImageDetailsView) => {
    setDetails(nextDetails);
    setSelection((current) => {
      const defaultPreset =
        nextDetails.stylePresets.find((preset) => preset.isDefault) ??
        nextDetails.stylePresets[0];
      const currentPresetExists = nextDetails.stylePresets.some(
        (preset) => preset.versionId === current?.stylePresetVersionId,
      );
      return {
        stylePresetVersionId:
          current && currentPresetExists
            ? current.stylePresetVersionId
            : (defaultPreset?.versionId ?? ""),
        quality: current?.quality ?? nextDetails.configuration.draftQuality,
        size: current?.size ?? nextDetails.configuration.defaultSize,
        // First load (no prior selection) pre-selects the canonical references
        // for the scene's assigned characters; later refreshes keep the user's
        // choice. Always drop ids no longer eligible.
        referenceAssetIds: (
          current?.referenceAssetIds ?? nextDetails.defaultReferenceAssetIds
        ).filter((id) =>
          nextDetails.references.some((reference) => reference.id === id),
        ),
      };
    });
  }, []);

  const loadDetails = useCallback(async () => {
    applyDetails(await fetchDetails());
  }, [applyDetails, fetchDetails]);

  useEffect(() => {
    let cancelled = false;
    fetchDetails()
      .then((nextDetails) => {
        if (!cancelled) applyDetails(nextDetails);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Scene image details could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyDetails, fetchDetails]);

  const derived = useMemo(() => {
    if (!details || !selection) return null;
    const stylePreset = details.stylePresets.find(
      (preset) => preset.versionId === selection.stylePresetVersionId,
    );
    if (!stylePreset) return null;
    const references = details.references.filter((reference) =>
      selection.referenceAssetIds.includes(reference.id),
    );
    const prompt = createSceneImagePromptPreview({
      stylePreset,
      characters: assignedCharacters,
      references,
      sceneVersion,
      size: selection.size,
      aspectRatio: projectAspectRatio,
    });
    const estimate = estimateSceneImageCost({
      prompt,
      quality: selection.quality,
      size: selection.size,
      referenceAssetCount: references.length,
      outputCostMatrix: details.configuration.outputCostMatrix,
      textInputCostPerMillionCents:
        details.configuration.textInputCostPerMillionCents,
      referenceInputReserveCents:
        details.configuration.referenceInputReserveCents,
      safetyMarginBasisPoints: 0,
    });
    const compression =
      selection.quality === "low"
        ? details.configuration.draftCompression
        : details.configuration.finalCompression;
    return {
      prompt,
      estimatedCostCents: estimate.estimatedCostCents,
      compression,
    };
  }, [
    assignedCharacters,
    details,
    projectAspectRatio,
    sceneVersion,
    selection,
  ]);

  const refreshAfterAction = useCallback(
    async (result: SceneImageActionResult): Promise<SceneImageActionResult> => {
      if (result.success) await loadDetails();
      return result;
    },
    [loadDetails],
  );

  const handleGenerate = useCallback(
    async (
      request: SceneImageGenerationRequest,
    ): Promise<SceneImageActionResult> => {
      const formData = new FormData();
      formData.set("projectId", scene.projectId);
      formData.set("sceneId", scene.id);
      formData.set("sceneVersionId", sceneVersion.id);
      formData.set("stylePresetVersionId", request.stylePresetVersionId);
      formData.set("requestNonce", request.requestNonce);
      formData.set("quality", request.quality);
      formData.set("size", request.size);
      appendReferenceIds(formData, request.referenceAssetIds);
      return refreshAfterAction(
        await startSceneImageGenerationAction(formData),
      );
    },
    [refreshAfterAction, scene.id, scene.projectId, sceneVersion.id],
  );

  const handlePoll = useCallback(
    async (generationId: string): Promise<void> => {
      if (document.hidden) return;
      const formData = new FormData();
      formData.set("projectId", scene.projectId);
      formData.set("generationId", generationId);
      const result = await reconcileSceneImageGenerationAction(formData);
      if (!result.success) throw new Error(result.error ?? "Refresh failed.");
      await loadDetails();
    },
    [loadDetails, scene.projectId],
  );

  const handleReview = useCallback(
    async (
      generationId: string,
      action: (formData: FormData) => Promise<SceneImageActionResult>,
    ): Promise<SceneImageActionResult> => {
      const formData = new FormData();
      formData.set("projectId", scene.projectId);
      formData.set("generationId", generationId);
      return refreshAfterAction(await action(formData));
    },
    [refreshAfterAction, scene.projectId],
  );

  if (loading)
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Loading scene image workspace...
      </div>
    );

  if (loadError || !details || !selection || !derived)
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive">
          Scene images are unavailable
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {loadError ?? "No workspace style preset is available."}
        </p>
        <button
          className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setLoading(true);
            setLoadError(null);
            loadDetails()
              .catch(() =>
                setLoadError("Scene image details could not be loaded."),
              )
              .finally(() => setLoading(false));
          }}
          type="button"
        >
          Try again
        </button>
      </div>
    );

  return (
    <SceneImagePanel
      budgetAvailable={
        derived.estimatedCostCents <= details.availableBudgetCents
      }
      canGenerate={canGenerate && details.configuration.enabled}
      canReview={canReview}
      compression={derived.compression}
      draftQuality={details.configuration.draftQuality}
      disabledReason={
        details.configuration.enabled
          ? undefined
          : "Scene image generation is disabled by server configuration."
      }
      estimatedCostCents={derived.estimatedCostCents}
      generations={details.generations}
      finalQuality={details.configuration.finalQuality}
      idPrefix={`scene-${scene.id}`}
      maximumReferenceAssets={details.configuration.maximumReferenceAssets}
      model={details.configuration.model}
      onApprove={(generationId) =>
        handleReview(generationId, approveGeneratedImageAction)
      }
      onGenerate={handleGenerate}
      onPoll={handlePoll}
      onReject={(generationId) =>
        handleReview(generationId, rejectGeneratedImageAction)
      }
      onSelectionChange={setSelection}
      outputFormat={details.configuration.outputFormat}
      promptPreview={derived.prompt}
      promptTemplateVersion={details.promptTemplateVersion}
      references={details.references}
      sceneApproved={scene.status === "approved"}
      sceneNumber={scene.sceneNumber}
      selection={selection}
      stylePresets={details.stylePresets}
    />
  );
}
