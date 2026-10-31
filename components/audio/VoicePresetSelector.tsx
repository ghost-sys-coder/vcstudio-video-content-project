"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VoicePresetForm } from "@/components/audio/VoicePresetForm";
import type {
  SceneAudioActionResult,
  VoicePresetView,
} from "@/lib/audio/audio-view";

export function VoicePresetSelector({
  voicePresets,
  selectedVoicePresetId,
  onSelect,
  canManage,
  defaultModel,
  onCreatePreset,
}: {
  voicePresets: VoicePresetView[];
  selectedVoicePresetId: string;
  onSelect: (voicePresetId: string) => void;
  canManage: boolean;
  defaultModel: string;
  onCreatePreset: (formData: FormData) => Promise<SceneAudioActionResult>;
}) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="audio-voice-preset">
          Voice preset
        </Label>
        <FormSelect
          className="min-w-52"
          id="audio-voice-preset"
          onValueChange={(selectedValue) => onSelect(selectedValue)}
          value={selectedVoicePresetId}
        >
          {voicePresets.map((preset) => (
            <SelectItem key={preset.id} value={String(preset.id)}>
              {preset.name} · {preset.isCustom ? "custom voice" : preset.voice}
              {preset.isDefault ? " (default)" : ""}
            </SelectItem>
          ))}
        </FormSelect>
      </div>
      {canManage ? (
        <>
          <Button
            className="shrink-0"
            onClick={() => setFormOpen(true)}
            size="icon-lg"
            title="New voice preset"
            type="button"
            variant="outline"
          >
            <PlusIcon aria-hidden />
            <span className="sr-only">New voice preset</span>
          </Button>
          <VoicePresetForm
            defaultModel={defaultModel}
            onCreate={onCreatePreset}
            onOpenChange={setFormOpen}
            open={formOpen}
          />
        </>
      ) : null}
    </div>
  );
}
