import { customVoiceAudioTypeFromMimeType } from "@/lib/schemas/scene-audio";

export const MAX_VOICE_RECORDING_BYTES = 10 * 1024 * 1024;

/** A recording captured in the browser, described by measurements only. */
export interface VoiceRecordingCapture {
  sizeBytes: number;
  mimeType: string;
  durationMilliseconds: number;
  /** Loudest sample observed while recording, 0–1. */
  peakLevel: number;
  /** Mean level across the recording, 0–1. Separates speech from room tone. */
  averageLevel: number;
}

export interface VoiceRecordingSpec {
  id: "consent" | "sample";
  title: string;
  minimumDurationMilliseconds: number;
  maximumDurationMilliseconds: number;
  /** Below this peak the microphone captured effectively nothing. */
  minimumPeakLevel: number;
  /** Below this average the recording is mostly silence. */
  minimumAverageLevel: number;
}

export const CONSENT_RECORDING_SPEC: VoiceRecordingSpec = {
  id: "consent",
  title: "Consent statement",
  minimumDurationMilliseconds: 4_000,
  maximumDurationMilliseconds: 60_000,
  minimumPeakLevel: 0.08,
  minimumAverageLevel: 0.005,
};

export const SAMPLE_RECORDING_SPEC: VoiceRecordingSpec = {
  id: "sample",
  title: "Voice sample",
  minimumDurationMilliseconds: 30_000,
  maximumDurationMilliseconds: 180_000,
  minimumPeakLevel: 0.08,
  minimumAverageLevel: 0.01,
};

export type VoiceRequirementStatus = "met" | "unmet" | "warning" | "waiting";

export interface VoiceRequirementResult {
  id: string;
  label: string;
  detail: string;
  status: VoiceRequirementStatus;
  /** A `warning` never blocks; an `unmet` blocking requirement does. */
  blocking: boolean;
}

function formatSeconds(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function formatMebibytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * Evaluates one captured recording against its spec. Returns the same
 * requirement rows whether or not a recording exists, so the interface can show
 * the full checklist up front and then mark rows as they are satisfied.
 */
export function evaluateVoiceRecording(
  spec: VoiceRecordingSpec,
  capture: VoiceRecordingCapture | null,
): VoiceRequirementResult[] {
  const captured: VoiceRequirementResult = {
    id: "captured",
    label: "Recording captured",
    detail: capture
      ? `${formatSeconds(capture.durationMilliseconds)} of audio is held in this browser and ready to play back.`
      : "Nothing has been recorded yet.",
    status: capture ? "met" : "waiting",
    blocking: true,
  };
  if (!capture)
    return [
      captured,
      {
        id: "duration",
        label: `At least ${formatSeconds(spec.minimumDurationMilliseconds)} long`,
        detail: `Record between ${formatSeconds(spec.minimumDurationMilliseconds)} and ${formatSeconds(spec.maximumDurationMilliseconds)}.`,
        status: "waiting",
        blocking: true,
      },
      {
        id: "audible",
        label: "Audible speech detected",
        detail: "The microphone level is measured while you record.",
        status: "waiting",
        blocking: true,
      },
      {
        id: "format",
        label: "Supported audio format",
        detail: "Set automatically by your browser.",
        status: "waiting",
        blocking: true,
      },
      {
        id: "size",
        label: `Under ${formatMebibytes(MAX_VOICE_RECORDING_BYTES)}`,
        detail: "Checked once the recording stops.",
        status: "waiting",
        blocking: true,
      },
    ];

  const tooShort =
    capture.durationMilliseconds < spec.minimumDurationMilliseconds;
  const tooLong =
    capture.durationMilliseconds > spec.maximumDurationMilliseconds;
  const supportedType = customVoiceAudioTypeFromMimeType(capture.mimeType);
  const silent = capture.peakLevel < spec.minimumPeakLevel;
  const quiet = !silent && capture.averageLevel < spec.minimumAverageLevel;

  return [
    captured,
    {
      id: "duration",
      label: `Between ${formatSeconds(spec.minimumDurationMilliseconds)} and ${formatSeconds(spec.maximumDurationMilliseconds)}`,
      detail: tooShort
        ? `This recording is ${formatSeconds(capture.durationMilliseconds)}. Record for at least ${formatSeconds(spec.minimumDurationMilliseconds)}.`
        : tooLong
          ? `This recording is ${formatSeconds(capture.durationMilliseconds)}. Keep it under ${formatSeconds(spec.maximumDurationMilliseconds)}.`
          : `${formatSeconds(capture.durationMilliseconds)} recorded.`,
      status: tooShort || tooLong ? "unmet" : "met",
      blocking: true,
    },
    {
      id: "audible",
      label: "Audible speech detected",
      detail: silent
        ? "Almost no sound was captured. Check that the right microphone is selected and unmuted."
        : quiet
          ? "The recording is quiet. It may still work, but moving closer to the microphone will help."
          : `Peak level ${Math.round(capture.peakLevel * 100)}%.`,
      status: silent ? "unmet" : quiet ? "warning" : "met",
      blocking: silent,
    },
    {
      id: "format",
      label: "Supported audio format",
      detail: supportedType
        ? `Recorded as ${supportedType}.`
        : `${capture.mimeType || "Unknown format"} is not accepted. Try a different browser.`,
      status: supportedType ? "met" : "unmet",
      blocking: true,
    },
    {
      id: "size",
      label: `Under ${formatMebibytes(MAX_VOICE_RECORDING_BYTES)}`,
      detail: `${formatMebibytes(capture.sizeBytes)} recorded.`,
      status: capture.sizeBytes <= MAX_VOICE_RECORDING_BYTES ? "met" : "unmet",
      blocking: true,
    },
  ];
}

export function isVoiceRecordingAcceptable(
  results: VoiceRequirementResult[],
): boolean {
  return !results.some(
    (result) =>
      result.blocking && result.status !== "met" && result.status !== "warning",
  );
}

export function voiceRecordingFileName(
  spec: VoiceRecordingSpec,
  mimeType: string,
): string {
  const extension = mimeType.toLowerCase().startsWith("audio/mp4")
    ? "m4a"
    : mimeType.toLowerCase().startsWith("audio/ogg")
      ? "ogg"
      : "webm";
  return `${spec.id}.${extension}`;
}
