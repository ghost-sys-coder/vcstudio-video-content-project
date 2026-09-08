"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { CustomVoiceEnrollmentLauncher } from "@/components/audio/CustomVoiceEnrollmentLauncher";
import { Button } from "@/components/ui/button";
import {
  fetchCustomVoiceOverview,
  revokeCustomVoiceRequest,
  type CustomVoiceSummary,
} from "@/lib/audio/custom-voice-client";

/**
 * Voices are rendered from a server-loaded list; provider availability is
 * probed only when enrollment is opened, so viewing settings never waits on an
 * outbound provider call.
 */
export function WorkspaceCustomVoicesSection({
  canManage,
  initialVoices,
}: {
  canManage: boolean;
  initialVoices: CustomVoiceSummary[];
}) {
  const [voices, setVoices] = useState(initialVoices);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const overview = await fetchCustomVoiceOverview();
    if (overview) setVoices(overview.voices);
    else setError("The cloned voice list could not be refreshed.");
  }

  async function revoke(customVoiceId: string, name: string) {
    if (
      !window.confirm(
        `Revoke "${name}" and archive its voice presets? Narration already generated with it stays available.`,
      )
    )
      return;
    const result = await revokeCustomVoiceRequest(customVoiceId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError(null);
    await refresh();
  }

  const activeVoices = voices.filter((voice) => voice.status === "active");

  return (
    <section className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Voice cloning</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enroll a voice once here and it becomes available as a narration
            preset in every project in this workspace.
          </p>
        </div>
        {canManage ? (
          <CustomVoiceEnrollmentLauncher onCreated={refresh} />
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {canManage ? null : (
          <p className="text-sm text-muted-foreground">
            Only workspace owners can enroll or revoke cloned voices.
          </p>
        )}
        {activeVoices.length ? (
          <ul className="divide-y rounded-lg border">
            {activeVoices.map((voice) => (
              <li
                key={voice.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{voice.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Consent language {voice.consentLanguage} · enrolled{" "}
                    {new Date(voice.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    onClick={() => void revoke(voice.id, voice.name)}
                    size="icon"
                    title={`Revoke ${voice.name}`}
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon aria-hidden />
                    <span className="sr-only">Revoke {voice.name}</span>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No cloned voices yet.</p>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
