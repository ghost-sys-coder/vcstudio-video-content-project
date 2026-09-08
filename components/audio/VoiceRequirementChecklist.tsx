"use client";

import { AlertTriangleIcon, CheckIcon, CircleIcon, XIcon } from "lucide-react";
import type { VoiceRequirementResult } from "@/lib/audio/voice-enrollment-requirements";

const ICONS = {
  met: CheckIcon,
  warning: AlertTriangleIcon,
  unmet: XIcon,
  waiting: CircleIcon,
} as const;

const TONES = {
  met: "text-emerald-600",
  warning: "text-amber-600",
  unmet: "text-destructive",
  waiting: "text-muted-foreground",
} as const;

const STATUS_LABELS = {
  met: "Met",
  warning: "Warning",
  unmet: "Not met",
  waiting: "Not recorded yet",
} as const;

export function VoiceRequirementChecklist({
  requirements,
}: {
  requirements: VoiceRequirementResult[];
}) {
  return (
    <ul className="space-y-2">
      {requirements.map((requirement) => {
        const Icon = ICONS[requirement.status];
        return (
          <li key={requirement.id} className="flex items-start gap-2">
            <Icon
              aria-hidden
              className={`mt-0.5 size-4 shrink-0 ${TONES[requirement.status]}`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {requirement.label}
                <span className="sr-only">
                  {" "}
                  — {STATUS_LABELS[requirement.status]}
                </span>
              </p>
              <p className={`text-xs ${TONES[requirement.status]}`}>
                {requirement.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
