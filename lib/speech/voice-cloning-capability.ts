/**
 * What a speech provider can do about voices, stated as data rather than
 * assumed by whichever screen is asking.
 *
 * **Cloning comes in two genuinely different shapes and the difference is not
 * cosmetic.** An *enrolled* provider takes a recording once, keeps the voice on
 * its own servers and hands back an identifier used forever after. A
 * *zero-shot* provider keeps nothing: it clones from a reference clip supplied
 * with every single synthesis request, so the clip is ours to store and ours to
 * send each time.
 *
 * That difference reaches everything — whether a consent step exists, whether a
 * voice can outlive our storage, what a deletion actually deletes — so it is
 * described here once and read everywhere, instead of each screen hard-coding
 * the habits of whichever provider was configured when it was written.
 */

export type SpeechProviderId = "openai" | "magpie";

/** Reference-clip requirements a recorder must satisfy before enrolment. */
export interface ZeroShotReferenceRequirements {
  minimumSeconds: number;
  maximumSeconds: number;
  minimumSampleRateHz: number;
  channels: 1;
  container: "wav";
  /** True when the model also needs the words spoken in the clip. */
  requiresTranscript: boolean;
}

export type VoiceCloningCapability =
  /** No cloning at all. Built-in voices only. */
  | { kind: "none" }
  /**
   * The provider enrols and stores the voice. We keep an identifier, not a
   * recording, and revoking means asking the provider to forget it.
   */
  | { kind: "enrolled"; requiresConsentRecording: boolean }
  /**
   * Nothing is stored provider-side. We hold the reference clip and send it
   * with every request, so deleting our copy is what makes the voice stop
   * existing.
   */
  | { kind: "zero_shot"; reference: ZeroShotReferenceRequirements };

/**
 * NVIDIA's published guidance for Magpie TTS Zeroshot: 16-bit mono WAV at
 * 22.05 kHz or higher, three to ten seconds, aiming for about five.
 */
export const MAGPIE_REFERENCE_REQUIREMENTS: ZeroShotReferenceRequirements = {
  minimumSeconds: 3,
  maximumSeconds: 10,
  minimumSampleRateHz: 22_050,
  channels: 1,
  container: "wav",
  // True only for the Flow models, which need `audio_prompt_transcript`.
  // Zeroshot clones from the audio alone.
  requiresTranscript: false,
};

export function isCloningSupported(
  capability: VoiceCloningCapability,
): boolean {
  return capability.kind !== "none";
}

/**
 * True when a voice exists only as long as our own stored clip does.
 *
 * Worth asking explicitly before telling anyone their voice has been deleted:
 * for an enrolled provider the recording also lives on someone else's servers,
 * and deleting our row is not the same promise.
 */
export function isVoiceOwnedLocally(
  capability: VoiceCloningCapability,
): boolean {
  return capability.kind === "zero_shot";
}
