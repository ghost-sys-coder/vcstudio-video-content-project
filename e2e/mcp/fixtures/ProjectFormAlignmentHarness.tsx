import { useState } from "react";
import { VoicePresetSelector } from "@/components/audio/VoicePresetSelector";
import { ProjectChannelSection } from "@/components/projects/ProjectChannelSection";
import { ProjectVisualDefault } from "@/components/video/ProjectVisualDefault";
import type { VoicePresetView } from "@/lib/audio/audio-view";

const presets: VoicePresetView[] = [
  {
    id: "default-preset",
    name: "Default narrator",
    voice: "cedar",
    model: "gpt-4o-mini-tts",
    instructions: "",
    speedScaledPercent: 100,
    format: "mp3",
    isDefault: true,
    isCustom: false,
  },
  {
    id: "long-preset",
    name: "A reusable narration preset with a deliberately long descriptive name",
    voice: "onyx",
    model: "gpt-4o-mini-tts",
    instructions: "",
    speedScaledPercent: 100,
    format: "mp3",
    isDefault: false,
    isCustom: false,
  },
];

export function ProjectFormAlignmentHarness() {
  const [voice, setVoice] = useState("default-preset");
  const canEdit = !new URLSearchParams(location.search).has("readOnly");
  return (
    <main className="app-container app-main app-page app-form-page">
      <section aria-label="Narration" className="app-panel">
        <VoicePresetSelector
          voicePresets={presets}
          selectedVoicePresetId={voice}
          onSelect={setVoice}
          canManage={canEdit}
          defaultModel="gpt-4o-mini-tts"
          onCreatePreset={async () => ({ success: true, error: null })}
        />
      </section>
      <ProjectVisualDefault
        workspaceId="test-workspace"
        projectId="test-project"
        initialKind="image"
        updatedAt="2026-11-10T00:00:00.000Z"
        canEdit={canEdit}
      />
      <ProjectChannelSection
        canEdit={canEdit}
        channels={[
          {
            id: "clear-work",
            name: "Clear Work Channel",
            platform: "youtube",
            canPublish: true,
          },
          {
            id: "disconnected-channel",
            name: "An independent production channel with a long name",
            platform: "youtube",
            canPublish: false,
          },
        ]}
        projectId="test-project"
        selectedChannelId={null}
      />
    </main>
  );
}
