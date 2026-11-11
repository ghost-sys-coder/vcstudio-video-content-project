import {
  fail,
  pass,
  warn,
  type GateResult,
} from "@/lib/production-runs/gates/gate-result";

export interface ImageGateInput {
  status: string;
  /** The size the pipeline requested, as `WIDTHxHEIGHT`. */
  requestedSize: string;
  /** The size the stored file actually decoded to, when known. */
  assetWidth: number | null;
  assetHeight: number | null;
  assetObjectKey: string | null;
  safeErrorMessage: string | null;
}

/**
 * Whether a generated scene image can be approved unseen.
 *
 * Deterministic only: it confirms the generation succeeded, that a file was
 * stored, and that the file is the shape that was asked for. It cannot see
 * the picture. Garbled text, a wrong character count or a composition that
 * contradicts the prompt pass this gate; a model-backed visual check is the
 * next increment and is deliberately not faked here.
 */
export function evaluateImageGate(input: ImageGateInput): GateResult {
  if (input.status !== "succeeded")
    return fail([
      input.safeErrorMessage
        ? `Generation ${input.status}: ${input.safeErrorMessage}`
        : `Generation ${input.status}.`,
    ]);
  if (!input.assetObjectKey)
    return fail(["The generation succeeded but no image file was stored."]);

  const [width, height] = input.requestedSize.split("x").map(Number);
  if (input.assetWidth === null || input.assetHeight === null)
    return warn(["The stored image's dimensions were not recorded."], 70);
  if (input.assetWidth !== width || input.assetHeight !== height)
    return fail([
      `The image is ${input.assetWidth}x${input.assetHeight}; ${input.requestedSize} was requested.`,
    ]);
  return pass([`Stored at ${input.requestedSize}.`], 100);
}
