import { calculateScriptStatistics } from "@/lib/domain/script-statistics";
import {
  fail,
  pass,
  warn,
  type GateResult,
} from "@/lib/production-runs/gates/gate-result";

export interface AudioGateInput {
  status: string;
  assetObjectKey: string | null;
  durationMilliseconds: number | null;
  /** The narration the clip was asked to speak. */
  narrationText: string;
  safeErrorMessage: string | null;
  /** The clip's loudness envelope, when the pipeline measured one. */
  amplitudeEnvelope: number[] | null;
}

/** Below this share of a clip's samples being audible, the clip is mostly silence. */
const MIN_AUDIBLE_SHARE = 0.35;
/** A sample under this level is treated as silence in the envelope's 0–1 scale. */
const SILENCE_THRESHOLD = 0.02;

/**
 * Whether a narration clip can be approved unseen.
 *
 * It checks what the stored facts allow: the clip exists, its measured length
 * is plausible for the words it was given, and, when an envelope was measured,
 * the clip is not mostly silence. It cannot hear mispronunciations or a wrong
 * voice; those stay with a person or a later transcription-backed gate.
 */
export function evaluateAudioGate(input: AudioGateInput): GateResult {
  if (input.status !== "succeeded")
    return fail([
      input.safeErrorMessage
        ? `Generation ${input.status}: ${input.safeErrorMessage}`
        : `Generation ${input.status}.`,
    ]);
  if (!input.assetObjectKey)
    return fail(["The generation succeeded but no audio file was stored."]);
  if (input.durationMilliseconds === null || input.durationMilliseconds <= 0)
    return fail(["The clip's duration was not measured."]);

  const reasons: string[] = [];
  let verdict: GateResult["verdict"] = "pass";
  let score = 100;

  const expectedSeconds = calculateScriptStatistics(
    input.narrationText,
  ).estimatedNarrationDurationSeconds;
  const actualSeconds = input.durationMilliseconds / 1000;
  if (expectedSeconds > 0) {
    const ratio = actualSeconds / expectedSeconds;
    const summary = `Measured ${actualSeconds.toFixed(1)}s for narration estimated at ${expectedSeconds.toFixed(1)}s.`;
    if (ratio < 0.4 || ratio > 2.5)
      return fail([`${summary} That does not match the words given.`]);
    if (ratio < 0.65 || ratio > 1.6) {
      verdict = "warn";
      score = Math.min(score, 60);
    }
    reasons.push(summary);
  }

  if (input.amplitudeEnvelope && input.amplitudeEnvelope.length > 0) {
    const audible = input.amplitudeEnvelope.filter(
      (level) => level > SILENCE_THRESHOLD,
    ).length;
    const share = audible / input.amplitudeEnvelope.length;
    if (share < MIN_AUDIBLE_SHARE)
      return fail([
        `Only ${Math.round(share * 100)}% of the clip is audible; it is mostly silence.`,
      ]);
    reasons.push(`${Math.round(share * 100)}% of the clip is audible.`);
  }

  return verdict === "warn" ? warn(reasons, score) : pass(reasons, score);
}
