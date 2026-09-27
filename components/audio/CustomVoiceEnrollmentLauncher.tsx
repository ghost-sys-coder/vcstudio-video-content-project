"use client";

import { useState } from "react";
import { Mic2Icon } from "lucide-react";
import { CustomVoiceEnrollmentDialog } from "@/components/audio/CustomVoiceEnrollmentDialog";
import { Button } from "@/components/ui/button";
import type { CustomVoiceAvailability } from "@/lib/audio/custom-voice-availability";
import { fetchCustomVoiceOverview } from "@/lib/audio/custom-voice-client";
import type { VoiceEnrollmentDetails } from "@/lib/speech/voice-enrollment-details";

const UNKNOWN_AVAILABILITY: CustomVoiceAvailability = {
  status: "unknown",
  detail: "",
};

interface EnrollmentState {
  availability: CustomVoiceAvailability;
  enrollment: VoiceEnrollmentDetails | null;
}

/**
 * Opens enrollment, probing the configured provider first so the dialog can
 * say up front that cloning is unavailable instead of after two recordings,
 * and so it asks for that provider's consent sentence and sample length.
 */
export function CustomVoiceEnrollmentLauncher({
  onCreated,
  size = "sm",
}: {
  onCreated: () => Promise<void>;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [probing, setProbing] = useState(false);
  const [resolved, setResolved] = useState<EnrollmentState | null>(null);

  async function openDialog() {
    // A failed probe is not remembered, so the next click asks again.
    if (!resolved?.enrollment) {
      setProbing(true);
      try {
        const overview = await fetchCustomVoiceOverview();
        setResolved({
          availability: overview?.availability ?? UNKNOWN_AVAILABILITY,
          enrollment: overview?.enrollment ?? null,
        });
      } finally {
        setProbing(false);
      }
    }
    setOpen(true);
  }

  return (
    <>
      <Button
        disabled={probing}
        onClick={() => void openDialog()}
        size={size}
        type="button"
      >
        <Mic2Icon aria-hidden />{" "}
        {probing ? "Checking provider…" : "Clone my voice"}
      </Button>
      <CustomVoiceEnrollmentDialog
        availability={resolved?.availability ?? UNKNOWN_AVAILABILITY}
        enrollment={resolved?.enrollment ?? null}
        onCreated={onCreated}
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}
