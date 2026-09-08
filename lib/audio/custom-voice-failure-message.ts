import { CustomVoiceProviderError } from "@/lib/domain/errors";

/**
 * Maps a provider failure to the message the user actually sees.
 *
 * The previous single catch-all ("verify the consent phrase and recording
 * quality") was actively misleading: it was returned even when the provider had
 * no custom-voice endpoints at all, so a correct recording looked like a bad
 * one. Only `recording_rejected` may blame the recording.
 */
export function customVoiceFailureMessage(error: unknown): string {
  if (!(error instanceof CustomVoiceProviderError))
    return "The custom voice could not be created. The request failed before it reached the voice provider.";

  switch (error.failure) {
    case "provider_not_enabled":
      return "This OpenAI organization is not approved for custom voices, so the recordings were never evaluated. Request custom voice access for the organization that owns this deployment's API key, then try again.";
    case "provider_unavailable":
      return "Voice cloning is not available on the connected provider account, so this recording was never evaluated. Ask a workspace owner to configure a voice cloning provider.";
    case "unauthorized":
      return "The voice provider rejected this deployment's credentials. Your recording was not the problem.";
    case "recording_rejected":
      return error.providerMessage
        ? `The voice provider rejected the recordings: ${error.providerMessage}`
        : "The voice provider rejected the recordings. Re-read the consent phrase exactly and record the sample in a quiet room.";
    case "rate_limited":
      return "Too many enrollment attempts reached the voice provider. Wait a few minutes and try again.";
    case "provider_error":
      return "The voice provider is unavailable right now. Your recordings were not the problem — try again shortly.";
  }
}

export function customVoiceFailureStatus(error: unknown): number {
  if (!(error instanceof CustomVoiceProviderError)) return 500;
  switch (error.failure) {
    case "recording_rejected":
      return 422;
    case "rate_limited":
      return 429;
    case "provider_not_enabled":
    case "provider_unavailable":
    case "unauthorized":
      return 503;
    case "provider_error":
      return 502;
  }
}
