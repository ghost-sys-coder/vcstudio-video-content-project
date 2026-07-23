"use client";

import { FailedSceneActions } from "@/components/storyboard/FailedSceneActions";
import { RegenerateSceneDialog } from "@/components/storyboard/RegenerateSceneDialog";
import { StoryboardSceneImageGroup } from "@/components/storyboard/StoryboardSceneImageGroup";
import { StoryboardSceneImageReviewRow } from "@/components/storyboard/StoryboardSceneImageReviewRow";
import { StoryboardSceneMetadata } from "@/components/storyboard/StoryboardSceneMetadata";
import { StoryboardSelectionCheckbox } from "@/components/storyboard/StoryboardSelectionCheckbox";
import { isSceneSelectableForBulk } from "@/lib/scenes/scene-image-eligibility";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import type {
  BulkGenerateHandler,
  StoryboardConfigurationView,
  StoryboardReviewHandler,
  StoryboardSceneView,
} from "@/lib/scenes/storyboard-view";
import { cn } from "@/lib/utils";

export function StoryboardSceneCard({
  scene,
  selected,
  onToggleSelect,
  canGenerate,
  canReview,
  stylePresets,
  configuration,
  availableBudgetCents,
  onApproveScene,
  onRejectScene,
  onGenerate,
}: {
  scene: StoryboardSceneView;
  selected: boolean;
  onToggleSelect: (sceneId: string, checked: boolean) => void;
  canGenerate: boolean;
  canReview: boolean;
  stylePresets: SceneImageStylePresetView[];
  configuration: StoryboardConfigurationView;
  availableBudgetCents: number;
  onApproveScene: StoryboardReviewHandler;
  onRejectScene: StoryboardReviewHandler;
  onGenerate: BulkGenerateHandler;
}) {
  const selectable = isSceneSelectableForBulk(scene.eligibility);
  const imagesNeedingReview = scene.images.filter(
    (image) =>
      image.latestStatus === "succeeded" &&
      image.latestReviewStatus === "pending",
  );
  const isFailed = scene.images.some(
    (image) => image.latestStatus === "failed",
  );
  const inProgress = scene.images.some(
    (image) =>
      image.latestStatus === "pending" ||
      image.latestStatus === "queued" ||
      image.latestStatus === "running",
  );

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 transition",
        selected ? "ring-2 ring-primary" : "ring-foreground/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StoryboardSelectionCheckbox
            checked={selected}
            disabled={!selectable || !canGenerate}
            label={`Select scene ${scene.sceneNumber}`}
            onChange={(checked) => onToggleSelect(scene.sceneId, checked)}
          />
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            Scene {scene.sceneNumber}
          </span>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset",
            scene.eligibility === "notApproved" &&
              "bg-muted text-muted-foreground ring-foreground/15",
            scene.eligibility === "inProgress" &&
              "bg-primary/10 text-primary ring-primary/20",
            scene.eligibility === "hasApprovedImage" &&
              "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
            scene.eligibility === "eligible" &&
              "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300",
          )}
        >
          {scene.eligibility === "notApproved"
            ? "Not approved"
            : scene.eligibility === "hasApprovedImage"
              ? "Approved image"
              : scene.eligibility === "inProgress"
                ? "Generating"
                : "Ready"}
        </span>
      </div>

      <StoryboardSceneImageGroup scene={scene} />
      <StoryboardSceneMetadata scene={scene} />

      {isFailed ? (
        <FailedSceneActions
          availableBudgetCents={availableBudgetCents}
          canGenerate={canGenerate}
          configuration={configuration}
          onGenerate={onGenerate}
          scene={scene}
          stylePresets={stylePresets}
        />
      ) : null}

      {imagesNeedingReview.length > 0 && canReview ? (
        <div className="space-y-2">
          {imagesNeedingReview.map((image) => (
            <StoryboardSceneImageReviewRow
              image={image}
              key={image.size}
              onApprove={onApproveScene}
              onReject={onRejectScene}
            />
          ))}
        </div>
      ) : null}

      {canGenerate && !isFailed && !inProgress && selectable ? (
        <RegenerateSceneDialog
          availableBudgetCents={availableBudgetCents}
          configuration={configuration}
          disabled={false}
          onGenerate={onGenerate}
          scene={scene}
          stylePresets={stylePresets}
        />
      ) : null}
    </article>
  );
}
