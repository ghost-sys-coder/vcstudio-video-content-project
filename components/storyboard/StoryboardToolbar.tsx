"use client";

import { Button } from "@/components/ui/button";
import { ApproveSelectedImagesButton } from "@/components/storyboard/ApproveSelectedImagesButton";
import { BulkGenerateButton } from "@/components/storyboard/BulkGenerateButton";
import { StoryboardFilters } from "@/components/storyboard/StoryboardFilters";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import type { StoryboardFilter } from "@/lib/scenes/storyboard-filter";
import type {
  BulkGenerateHandler,
  BulkSceneImageActionResult,
  StoryboardConfigurationView,
} from "@/lib/scenes/storyboard-view";

export function StoryboardToolbar({
  filter,
  filterCounts,
  onFilterChange,
  selectedSceneIds,
  eligibleSceneIds,
  approvableCount,
  onSelectAllEligible,
  onClearSelection,
  onGenerate,
  onApproveSelected,
  stylePresets,
  configuration,
  availableBudgetCents,
  canGenerate,
  canReview,
}: {
  filter: StoryboardFilter;
  filterCounts: Record<StoryboardFilter, number>;
  onFilterChange: (filter: StoryboardFilter) => void;
  selectedSceneIds: string[];
  eligibleSceneIds: string[];
  approvableCount: number;
  onSelectAllEligible: () => void;
  onClearSelection: () => void;
  onGenerate: BulkGenerateHandler;
  onApproveSelected: () => Promise<BulkSceneImageActionResult>;
  stylePresets: SceneImageStylePresetView[];
  configuration: StoryboardConfigurationView;
  availableBudgetCents: number;
  canGenerate: boolean;
  canReview: boolean;
}) {
  const selectionSceneIds =
    selectedSceneIds.length > 0 ? selectedSceneIds : eligibleSceneIds;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StoryboardFilters
          counts={filterCounts}
          onChange={onFilterChange}
          value={filter}
        />
        {canGenerate ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={eligibleSceneIds.length === 0}
              onClick={onSelectAllEligible}
              size="sm"
              type="button"
              variant="ghost"
            >
              Select eligible ({eligibleSceneIds.length})
            </Button>
            {selectedSceneIds.length > 0 ? (
              <Button
                onClick={onClearSelection}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            ) : null}
            {canReview ? (
              <ApproveSelectedImagesButton
                count={approvableCount}
                disabled={approvableCount === 0}
                onApproveSelected={onApproveSelected}
              />
            ) : null}
            <BulkGenerateButton
              availableBudgetCents={availableBudgetCents}
              configuration={configuration}
              disabled={selectionSceneIds.length === 0}
              onGenerate={onGenerate}
              sceneIds={selectionSceneIds}
              stylePresets={stylePresets}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
