"use client";

import { useState } from "react";
import { Mic2Icon, Trash2Icon } from "lucide-react";
import { revokeCustomVoiceAction } from "@/app/(authenticated)/app/projects/[projectId]/audio/actions";
import { Button } from "@/components/ui/button";
import { CustomVoiceEnrollmentDialog } from "@/components/audio/CustomVoiceEnrollmentDialog";
import type { CustomVoiceView } from "@/lib/audio/audio-view";

export function CustomVoiceManager({
  projectId,
  voices,
  onChanged,
}: {
  projectId: string;
  voices: CustomVoiceView[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke(customVoiceId: string) {
    if (
      !window.confirm(
        "Revoke this custom voice and archive its presets? Existing generated audio will remain available.",
      )
    )
      return;
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("customVoiceId", customVoiceId);
    const result = await revokeCustomVoiceAction(formData);
    if (!result.success) setError(result.error);
    else await onChanged();
  }

  const active = voices.filter((voice) => voice.status === "active");
  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Custom voices</h2>
          <p className="text-sm text-muted-foreground">
            Verified self-voice clones for this workspace.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Mic2Icon aria-hidden /> Clone my voice
        </Button>
      </div>
      {active.length ? (
        <ul className="mt-4 divide-y">
          {active.map((voice) => (
            <li
              key={voice.id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="text-sm font-medium">{voice.name}</p>
                <p className="text-xs text-muted-foreground">
                  Consent: {voice.consentLanguage}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title="Revoke custom voice"
                onClick={() => revoke(voice.id)}
              >
                <Trash2Icon aria-hidden />
                <span className="sr-only">Revoke {voice.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No active custom voices.
        </p>
      )}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <CustomVoiceEnrollmentDialog
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        onCreated={onChanged}
      />
    </section>
  );
}
