"use client";

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
        <select
          className="h-9 min-w-52 rounded-lg border border-input bg-background px-3 text-sm"
          id="audio-voice-preset"
          onChange={(event) => onSelect(event.target.value)}
          value={selectedVoicePresetId}
        >
          {voicePresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} · {preset.voice}
              {preset.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </div>
      {canManage ? (
        <>
          <Button
            onClick={() => setFormOpen(true)}
            size="icon"
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
