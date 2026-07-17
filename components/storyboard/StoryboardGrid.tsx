"use client";

import { StoryboardSceneCard } from "@/components/storyboard/StoryboardSceneCard";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import type {
  BulkGenerateHandler,
  StoryboardConfigurationView,
  StoryboardReviewHandler,
  StoryboardSceneView,
} from "@/lib/scenes/storyboard-view";

export function StoryboardGrid({
  scenes,
  selectedSceneIds,
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
  scenes: StoryboardSceneView[];
  selectedSceneIds: ReadonlySet<string>;
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
  if (scenes.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No scenes match this filter.
      </div>
    );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {scenes.map((scene) => (
        <StoryboardSceneCard
          availableBudgetCents={availableBudgetCents}
          canGenerate={canGenerate}
          canReview={canReview}
          configuration={configuration}
          key={scene.sceneId}
          onApproveScene={onApproveScene}
          onGenerate={onGenerate}
          onRejectScene={onRejectScene}
          onToggleSelect={onToggleSelect}
          scene={scene}
          selected={selectedSceneIds.has(scene.sceneId)}
          stylePresets={stylePresets}
        />
      ))}
    </div>
  );
}
