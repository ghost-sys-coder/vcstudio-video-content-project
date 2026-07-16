"use client";

import type {
  SceneImageActionResult,
  SceneImageGenerationRequest,
  SceneImageGenerationView,
  SceneImageOutputFormat,
  SceneImageReferenceView,
  SceneImageSelection,
  SceneImageStylePresetView,
} from "@/lib/scenes/scene-image-view";
import { isActiveSceneImageGenerationStatus } from "@/lib/scenes/scene-image-view";
import { GenerateSceneImageButton } from "@/components/scenes/GenerateSceneImageButton";
import { GeneratedImageCard } from "@/components/scenes/GeneratedImageCard";
import { GenerationCostEstimate } from "@/components/scenes/GenerationCostEstimate";
import { ImageGenerationProgress } from "@/components/scenes/ImageGenerationProgress";
import { ImagePromptPreview } from "@/components/scenes/ImagePromptPreview";
import { ImageQualitySelector } from "@/components/scenes/ImageQualitySelector";
import { ImageSizeSelector } from "@/components/scenes/ImageSizeSelector";
import { ReferenceAssetSelector } from "@/components/scenes/ReferenceAssetSelector";
import { StylePresetSelector } from "@/components/scenes/StylePresetSelector";

export function SceneImagePanel({
  idPrefix,
  sceneNumber,
  sceneApproved,
  canGenerate,
  canReview,
  selection,
  stylePresets,
  references,
  maximumReferenceAssets,
  promptPreview,
  promptTemplateVersion,
  estimatedCostCents,
  budgetAvailable,
  model,
  outputFormat,
  draftQuality,
  finalQuality,
  compression,
  generations,
  disabledReason,
  onSelectionChange,
  onGenerate,
  onPoll,
  onApprove,
  onReject,
}: {
  idPrefix: string;
  sceneNumber: number;
  sceneApproved: boolean;
  canGenerate: boolean;
  canReview: boolean;
  selection: SceneImageSelection;
  stylePresets: SceneImageStylePresetView[];
  references: SceneImageReferenceView[];
  maximumReferenceAssets: number;
  promptPreview: string;
  promptTemplateVersion: string;
  estimatedCostCents: number;
  budgetAvailable: boolean;
  model: string;
  outputFormat: SceneImageOutputFormat;
  draftQuality: "low";
  finalQuality: "medium";
  compression: number;
  generations: SceneImageGenerationView[];
  disabledReason?: string;
  onSelectionChange: (selection: SceneImageSelection) => void;
  onGenerate: (
    request: SceneImageGenerationRequest,
  ) => Promise<SceneImageActionResult>;
  onPoll?: (generationId: string) => Promise<void>;
  onApprove: (generationId: string) => Promise<SceneImageActionResult>;
  onReject: (generationId: string) => Promise<SceneImageActionResult>;
}) {
  const activeGeneration = generations.find((generation) =>
    isActiveSceneImageGenerationStatus(generation.status),
  );
  const selectedStyle = stylePresets.find(
    (preset) => preset.versionId === selection.stylePresetVersionId,
  );
  const configurationDisabled = Boolean(activeGeneration);
  const generationDisabled =
    !sceneApproved ||
    !canGenerate ||
    !budgetAvailable ||
    configurationDisabled ||
    !selectedStyle;
  const generatedDisabledReason =
    disabledReason ??
    (!sceneApproved
      ? "Approve this scene version before generating an image."
      : !canGenerate
        ? "Your workspace role cannot generate scene images."
        : !budgetAvailable
          ? "The project or workspace budget cannot cover this reservation."
          : configurationDisabled
            ? "Wait for the active image generation to finish."
            : !selectedStyle
              ? "Choose a versioned style preset first."
              : undefined);
  const qualityLabel =
    selection.quality === draftQuality
      ? "Draft / low"
      : selection.quality === finalQuality
        ? "Final / medium"
        : "High / manual opt-in";

  return (
    <section
      aria-labelledby={`${idPrefix}-image-panel-heading`}
      className="space-y-5 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="font-heading text-base font-medium"
            id={`${idPrefix}-image-panel-heading`}
          >
            Scene {sceneNumber} image
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Compose, generate, and review one scene image at a time.
          </p>
        </div>
        <p className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {generations.length} generation{generations.length === 1 ? "" : "s"}
        </p>
      </div>

      {!sceneApproved ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Image generation is locked until this scene version is approved.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <StylePresetSelector
          disabled={configurationDisabled || !canGenerate}
          id={`${idPrefix}-style-preset`}
          onChange={(stylePresetVersionId) =>
            onSelectionChange({ ...selection, stylePresetVersionId })
          }
          presets={stylePresets}
          value={selection.stylePresetVersionId}
        />
        <ImageSizeSelector
          disabled={configurationDisabled || !canGenerate}
          id={`${idPrefix}-image-size`}
          onChange={(size) => onSelectionChange({ ...selection, size })}
          value={selection.size}
        />
      </div>
      <ImageQualitySelector
        disabled={configurationDisabled || !canGenerate}
        draftQuality={draftQuality}
        finalQuality={finalQuality}
        idPrefix={idPrefix}
        onChange={(quality) => onSelectionChange({ ...selection, quality })}
        value={selection.quality}
      />
      <ReferenceAssetSelector
        disabled={configurationDisabled || !canGenerate}
        id={`${idPrefix}-references`}
        maximumSelected={maximumReferenceAssets}
        onChange={(referenceAssetIds) =>
          onSelectionChange({ ...selection, referenceAssetIds })
        }
        references={references}
        selectedIds={selection.referenceAssetIds}
      />
      <ImagePromptPreview
        id={`${idPrefix}-prompt-preview`}
        prompt={promptPreview}
        promptTemplateVersion={promptTemplateVersion}
      />
      <GenerationCostEstimate
        budgetAvailable={budgetAvailable}
        compression={compression}
        estimatedCostCents={estimatedCostCents}
        id={`${idPrefix}-generation-cost`}
        model={model}
        outputFormat={outputFormat}
      />
      <GenerateSceneImageButton
        disabled={generationDisabled}
        disabledReason={generatedDisabledReason}
        estimatedCostCents={estimatedCostCents}
        model={model}
        onConfirm={(requestNonce) => onGenerate({ ...selection, requestNonce })}
        qualityLabel={qualityLabel}
        referenceCount={selection.referenceAssetIds.length}
        size={selection.size}
        stylePresetLabel={
          selectedStyle
            ? `${selectedStyle.name} v${selectedStyle.version}`
            : "Not selected"
        }
      />

      {activeGeneration ? (
        <ImageGenerationProgress
          generationId={activeGeneration.id}
          generationVersion={activeGeneration.generationVersion}
          onPoll={onPoll}
          progressPercent={activeGeneration.progressPercent}
          status={activeGeneration.status}
        />
      ) : null}

      <section
        aria-labelledby={`${idPrefix}-history-heading`}
        className="space-y-3"
      >
        <div>
          <h3
            className="text-sm font-medium"
            id={`${idPrefix}-history-heading`}
          >
            Generation history
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Approvals change the current scene image without deleting older
            generations.
          </p>
        </div>
        {generations.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {generations.map((generation) => (
              <GeneratedImageCard
                canReview={canReview}
                generation={generation}
                key={generation.id}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No image generations exist for this scene version yet.
          </div>
        )}
      </section>
    </section>
  );
}
