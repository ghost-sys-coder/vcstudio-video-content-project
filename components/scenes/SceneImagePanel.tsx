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
import { groupSceneImageGenerationsBySize } from "@/lib/scenes/scene-image-grouping";
import { getSceneImageSizeLabel } from "@/lib/scenes/scene-image-size-options";
import { GenerateSceneImageButton } from "@/components/scenes/GenerateSceneImageButton";
import { GenerationCostEstimate } from "@/components/scenes/GenerationCostEstimate";
import { ImageGenerationProgress } from "@/components/scenes/ImageGenerationProgress";
import { ImagePromptPreview } from "@/components/scenes/ImagePromptPreview";
import { ImageQualitySelector } from "@/components/scenes/ImageQualitySelector";
import { ImageSizeMultiSelect } from "@/components/scenes/ImageSizeMultiSelect";
import { ReferenceAssetSelector } from "@/components/scenes/ReferenceAssetSelector";
import { SceneImageSizeGroup } from "@/components/scenes/SceneImageSizeGroup";
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
  promptPreviews,
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
  promptPreviews: { size: string; prompt: string }[];
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
        <ImageSizeMultiSelect
          disabled={configurationDisabled || !canGenerate}
          id={`${idPrefix}-image-size`}
          onChange={(sizes) => onSelectionChange({ ...selection, sizes })}
          value={selection.sizes}
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
      <div className="space-y-4">
        {promptPreviews.map((preview) => (
          <ImagePromptPreview
            id={`${idPrefix}-prompt-preview-${preview.size}`}
            key={preview.size}
            prompt={preview.prompt}
            promptTemplateVersion={promptTemplateVersion}
            sizeLabel={
              promptPreviews.length > 1
                ? getSceneImageSizeLabel(
                    preview.size as (typeof selection.sizes)[number],
                  )
                : undefined
            }
          />
        ))}
      </div>
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
        sizes={selection.sizes}
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
            Grouped by size — each size can have its own approved image.
            Approving one size never changes another size&apos;s approval.
          </p>
        </div>
        {generations.length ? (
          <div className="space-y-6">
            {groupSceneImageGenerationsBySize(generations).map((group) => (
              <SceneImageSizeGroup
                canReview={canReview}
                group={group}
                key={group.size}
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
