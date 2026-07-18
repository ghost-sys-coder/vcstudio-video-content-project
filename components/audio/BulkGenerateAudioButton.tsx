"use client";

import { useState } from "react";
import { AudioLinesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioGenerationDialog } from "@/components/audio/AudioGenerationDialog";
import { estimateSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import type {
  AudioConfigurationView,
  AudioGenerateHandler,
  AudioSceneView,
} from "@/lib/audio/audio-view";

export function BulkGenerateAudioButton({
  scenes,
  voicePresetId,
  voicePresetName,
  configuration,
  availableBudgetCents,
  disabled,
  onGenerate,
}: {
  scenes: AudioSceneView[];
  voicePresetId: string;
  voicePresetName: string;
  configuration: AudioConfigurationView;
  availableBudgetCents: number;
  disabled: boolean;
  onGenerate: AudioGenerateHandler;
}) {
  const [open, setOpen] = useState(false);
  const rates = {
    costPerMillionCharactersCents: configuration.costPerMillionCharactersCents,
    minimumEstimateCents: configuration.minimumEstimateCents,
  };
  const estimatedCostCents = scenes.reduce(
    (total, scene) =>
      total +
      estimateSceneAudioCostCents({
        characterCount: scene.characterCount,
        rates,
      }),
    0,
  );

  return (
    <>
      <Button
        disabled={disabled || scenes.length === 0}
        onClick={() => setOpen(true)}
        type="button"
      >
        <AudioLinesIcon aria-hidden />
        Generate {scenes.length > 0 ? `(${scenes.length})` : "selected"}
      </Button>
      <AudioGenerationDialog
        availableBudgetCents={availableBudgetCents}
        confirmLabel={`Generate ${scenes.length} ${scenes.length === 1 ? "scene" : "scenes"}`}
        description={`Generate narration audio for ${scenes.length} selected ${scenes.length === 1 ? "scene" : "scenes"}.`}
        estimatedCostCents={estimatedCostCents}
        maximumScenesPerBatch={configuration.maximumScenesPerBatch}
        onConfirm={() =>
          onGenerate({
            sceneIds: scenes.map((scene) => scene.sceneId),
            voicePresetId,
          })
        }
        onOpenChange={setOpen}
        open={open}
        sceneCount={scenes.length}
        title="Generate selected scene audio"
        voicePresetName={voicePresetName}
      />
    </>
  );
}
