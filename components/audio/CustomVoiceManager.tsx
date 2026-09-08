"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2Icon } from "lucide-react";
import { CustomVoiceEnrollmentLauncher } from "@/components/audio/CustomVoiceEnrollmentLauncher";
import { Button } from "@/components/ui/button";
import { revokeCustomVoiceRequest } from "@/lib/audio/custom-voice-client";
import type { CustomVoiceView } from "@/lib/audio/audio-view";

export function CustomVoiceManager({
  voices,
  onChanged,
}: {
  voices: CustomVoiceView[];
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function revoke(customVoiceId: string) {
    if (
      !window.confirm(
        "Revoke this custom voice and archive its presets? Existing generated audio will remain available.",
      )
    )
      return;
    const result = await revokeCustomVoiceRequest(customVoiceId);
    if (!result.success) setError(result.error);
    else {
      setError(null);
      await onChanged();
    }
  }

  const active = voices.filter((voice) => voice.status === "active");
  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Custom voices</h2>
          <p className="text-sm text-muted-foreground">
            Verified self-voice clones, shared across every project in this
            workspace. Manage them in{" "}
            <Link className="underline" href="/app/settings/workspace">
              workspace settings
            </Link>
            .
          </p>
        </div>
        <CustomVoiceEnrollmentLauncher onCreated={onChanged} />
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
                onClick={() => revoke(voice.id)}
                size="icon"
                title="Revoke custom voice"
                type="button"
                variant="ghost"
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
    </section>
  );
}
