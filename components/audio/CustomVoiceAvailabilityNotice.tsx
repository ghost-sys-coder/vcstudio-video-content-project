"use client";

import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import type { CustomVoiceAvailability } from "@/lib/audio/custom-voice-availability";

export function CustomVoiceAvailabilityNotice({
  availability,
}: {
  availability: CustomVoiceAvailability;
}) {
  if (availability.status === "available") return null;
  const blocking =
    availability.status === "unsupported" ||
    availability.status === "unauthorized";
  const Icon = blocking ? AlertTriangleIcon : InfoIcon;
  return (
    <div
      className={
        blocking
          ? "flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
          : "flex gap-2 rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 dark:bg-amber-950/20"
      }
      role="status"
    >
      <Icon
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${blocking ? "text-destructive" : "text-amber-600"}`}
      />
      <div>
        <p className="text-sm font-medium">
          {blocking
            ? "Voice cloning is unavailable"
            : "Voice cloning status unconfirmed"}
        </p>
        <p className="text-sm text-muted-foreground">{availability.detail}</p>
      </div>
    </div>
  );
}
