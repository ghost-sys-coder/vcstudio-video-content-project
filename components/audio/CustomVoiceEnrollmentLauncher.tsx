"use client";

import { useState } from "react";
import { Mic2Icon } from "lucide-react";
import { CustomVoiceEnrollmentDialog } from "@/components/audio/CustomVoiceEnrollmentDialog";
import { Button } from "@/components/ui/button";
import type { CustomVoiceAvailability } from "@/lib/audio/custom-voice-availability";
import { fetchCustomVoiceOverview } from "@/lib/audio/custom-voice-client";

const UNKNOWN_AVAILABILITY: CustomVoiceAvailability = {
  status: "unknown",
  detail: "",
};

/**
 * Opens enrollment, probing provider availability first so the dialog can say
 * up front that cloning is unavailable instead of after two recordings.
 */
export function CustomVoiceEnrollmentLauncher({
  availability,
  onCreated,
  size = "sm",
}: {
  availability?: CustomVoiceAvailability;
  onCreated: () => Promise<void>;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [probing, setProbing] = useState(false);
  const [resolved, setResolved] = useState<CustomVoiceAvailability | null>(
    availability ?? null,
  );

  async function openDialog() {
    if (!resolved) {
      setProbing(true);
      try {
        const overview = await fetchCustomVoiceOverview();
        setResolved(overview?.availability ?? UNKNOWN_AVAILABILITY);
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
        availability={resolved ?? UNKNOWN_AVAILABILITY}
        onCreated={onCreated}
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}
