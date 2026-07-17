"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkGenerateDialog } from "@/components/storyboard/BulkGenerateDialog";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import type {
  BulkGenerateHandler,
  StoryboardConfigurationView,
} from "@/lib/scenes/storyboard-view";

export function BulkGenerateButton({
  sceneIds,
  stylePresets,
  configuration,
  availableBudgetCents,
  disabled,
  onGenerate,
}: {
  sceneIds: string[];
  stylePresets: SceneImageStylePresetView[];
  configuration: StoryboardConfigurationView;
  availableBudgetCents: number;
  disabled: boolean;
  onGenerate: BulkGenerateHandler;
}) {
  const [open, setOpen] = useState(false);
  const count = sceneIds.length;

  return (
    <>
      <Button
        disabled={disabled || count === 0}
        onClick={() => setOpen(true)}
        type="button"
      >
        <SparklesIcon aria-hidden />
        Generate {count > 0 ? `(${count})` : "selected"}
      </Button>
      <BulkGenerateDialog
        availableBudgetCents={availableBudgetCents}
        configuration={configuration}
        description={`Generate images for ${count} selected ${count === 1 ? "scene" : "scenes"}. Review the estimated cost before confirming.`}
        onGenerate={onGenerate}
        onOpenChange={setOpen}
        open={open}
        sceneIds={sceneIds}
        stylePresets={stylePresets}
        title="Generate selected scenes"
      />
    </>
  );
}
