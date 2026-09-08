import type { CustomVoiceProviderFailure } from "@/lib/domain/errors";

/**
 * Whether the connected provider can enroll custom voices at all.
 *
 * This is checked before the enrollment UI asks anyone to record, because the
 * failure mode it guards against is indistinguishable from a bad recording once
 * enrollment has already been attempted: the provider answers "endpoint not
 * found" and the user is told to re-read the consent phrase.
 */
export type CustomVoiceAvailabilityStatus =
  "available" | "unsupported" | "unauthorized" | "unknown";

export interface CustomVoiceAvailability {
  status: CustomVoiceAvailabilityStatus;
  /** Operator-facing explanation. Safe to show to workspace owners. */
  detail: string;
}

export const CUSTOM_VOICE_UNSUPPORTED_DETAIL =
  "The connected OpenAI project does not expose custom voice endpoints. Voice cloning cannot run until a provider that supports it is configured.";

export function availabilityFromFailure(
  failure: CustomVoiceProviderFailure,
): CustomVoiceAvailability {
  switch (failure) {
    case "provider_unavailable":
      return { status: "unsupported", detail: CUSTOM_VOICE_UNSUPPORTED_DETAIL };
    case "unauthorized":
      return {
        status: "unauthorized",
        detail:
          "The configured API key was rejected. Check the provider credentials for this deployment.",
      };
    case "rate_limited":
      return {
        status: "unknown",
        detail:
          "The provider is rate limiting requests right now. Try again shortly.",
      };
    case "recording_rejected":
    case "provider_error":
      return {
        status: "unknown",
        detail:
          "The provider could not confirm custom voice support. Try again shortly.",
      };
  }
}

export function isEnrollmentBlocked(
  availability: CustomVoiceAvailability,
): boolean {
  return (
    availability.status === "unsupported" ||
    availability.status === "unauthorized"
  );
}
