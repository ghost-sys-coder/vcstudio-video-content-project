"use client";

import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkGenerateDialog } from "@/components/storyboard/BulkGenerateDialog";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import type {
  BulkGenerateHandler,
  StoryboardConfigurationView,
  StoryboardSceneView,
} from "@/lib/scenes/storyboard-view";

export function RegenerateSceneDialog({
  scene,
  stylePresets,
  configuration,
  availableBudgetCents,
  disabled,
  onGenerate,
}: {
  scene: StoryboardSceneView;
  stylePresets: SceneImageStylePresetView[];
  configuration: StoryboardConfigurationView;
  availableBudgetCents: number;
  disabled: boolean;
  onGenerate: BulkGenerateHandler;
}) {
  const [open, setOpen] = useState(false);
  const isRetry = scene.latestStatus === "failed";

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCwIcon aria-hidden />
        {isRetry ? "Retry" : "Regenerate"}
      </Button>
      <BulkGenerateDialog
        availableBudgetCents={availableBudgetCents}
        configuration={configuration}
        description={`Create a new image for scene ${scene.sceneNumber}. This starts a new paid generation version.`}
        onGenerate={onGenerate}
        onOpenChange={setOpen}
        open={open}
        sceneIds={[scene.sceneId]}
        stylePresets={stylePresets}
        title={
          isRetry
            ? `Retry scene ${scene.sceneNumber}`
            : `Regenerate scene ${scene.sceneNumber}`
        }
      />
    </>
  );
}
