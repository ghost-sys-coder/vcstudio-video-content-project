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

export function GenerateSceneAudioButton({
  scene,
  voicePresetId,
  voicePresetName,
  configuration,
  availableBudgetCents,
  disabled,
  onGenerate,
}: {
  scene: AudioSceneView;
  voicePresetId: string;
  voicePresetName: string;
  configuration: AudioConfigurationView;
  availableBudgetCents: number;
  disabled: boolean;
  onGenerate: AudioGenerateHandler;
}) {
  const [open, setOpen] = useState(false);
  const estimatedCostCents = estimateSceneAudioCostCents({
    characterCount: scene.characterCount,
    rates: {
      costPerMillionCharactersCents:
        configuration.costPerMillionCharactersCents,
      minimumEstimateCents: configuration.minimumEstimateCents,
    },
  });

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        <AudioLinesIcon aria-hidden />
        Generate
      </Button>
      <AudioGenerationDialog
        availableBudgetCents={availableBudgetCents}
        confirmLabel="Generate narration"
        description={`Generate narration audio for scene ${scene.sceneNumber}.`}
        estimatedCostCents={estimatedCostCents}
        maximumScenesPerBatch={configuration.maximumScenesPerBatch}
        onConfirm={() =>
          onGenerate({ sceneIds: [scene.sceneId], voicePresetId })
        }
        onOpenChange={setOpen}
        open={open}
        sceneCount={1}
        title={`Generate scene ${scene.sceneNumber} audio`}
        voicePresetName={voicePresetName}
      />
    </>
  );
}
