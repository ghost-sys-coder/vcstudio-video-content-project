import { z } from "zod";
import type { CustomVoiceAvailability } from "@/lib/audio/custom-voice-availability";

const overviewSchema = z.object({
  availability: z.object({
    status: z.enum(["available", "unsupported", "unauthorized", "unknown"]),
    detail: z.string(),
  }),
  canManage: z.boolean(),
  voices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      consentLanguage: z.string(),
      status: z.enum(["active", "revoked"]),
      createdAt: z.string(),
    }),
  ),
});

export interface CustomVoiceSummary {
  id: string;
  name: string;
  consentLanguage: string;
  status: "active" | "revoked";
  createdAt: string;
}

export interface CustomVoiceOverview {
  availability: CustomVoiceAvailability;
  canManage: boolean;
  voices: CustomVoiceSummary[];
}

export async function fetchCustomVoiceOverview(): Promise<CustomVoiceOverview | null> {
  const response = await fetch("/api/workspace/custom-voices", {
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const parsed = overviewSchema.safeParse(
    await response.json().catch(() => null),
  );
  return parsed.success ? parsed.data : null;
}

export async function revokeCustomVoiceRequest(
  customVoiceId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const response = await fetch(
    `/api/workspace/custom-voices/${encodeURIComponent(customVoiceId)}`,
    { method: "DELETE" },
  ).catch(() => null);
  if (!response)
    return { success: false, error: "The request could not be sent." };
  if (response.ok) return { success: true };
  const payload: unknown = await response.json().catch(() => null);
  return {
    success: false,
    error:
      typeof payload === "object" &&
      payload !== null &&
      typeof Reflect.get(payload, "error") === "string"
        ? String(Reflect.get(payload, "error"))
        : "The custom voice could not be revoked.",
  };
}
