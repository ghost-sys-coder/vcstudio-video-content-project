import { useState } from "react";
import { VoicePresetForm } from "@/components/audio/VoicePresetForm";
export function ElevenLabsVoiceHarness() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  return (
    <>
      <VoicePresetForm
        open={open}
        onOpenChange={setOpen}
        defaultModel="gpt-4o-mini-tts"
        onCreate={async (data) => {
          setSaved(
            Object.fromEntries(
              [...data.entries()].map(([k, v]) => [k, String(v)]),
            ),
          );
          return { success: true, error: null };
        }}
      />
      {saved ? (
        <output aria-label="Saved preset" className="break-all">
          {JSON.stringify(saved)}
        </output>
      ) : null}
      <button onClick={() => setOpen(true)}>New voice preset</button>
    </>
  );
}
