/**
 * What a person is agreeing to when they confirm a reframe, and what they are
 * agreeing to when they stop one.
 *
 * Pure and separate from the dialog because this is the moment money is
 * committed. A reframe extends every AI-generated still with a paid image
 * generation, so the consequences have to be stated in full, in one place, and
 * be testable. Wording assembled inside a component drifts from what the
 * planner actually decided, and the first sign of that is a surprise bill.
 */

import { formatUsdCents } from "@/lib/format/currency";
import {
  describeCoverCrop,
  measureCoverCrop,
} from "@/lib/render/frame-geometry";
import {
  getSceneImageDimensions,
  getSceneImageSizeForAspectRatio,
} from "@/lib/schemas/scene-image";

/** The planner's totals as they cross the wire to the browser. */
export interface ReframePlanSummary {
  sceneCount: number;
  extendCount: number;
  cropCount: number;
  readyCount: number;
  /** Scenes with nothing approved. Any of these refuses the whole job. */
  blockedSceneNumbers: number[];
  /** Scenes that cannot be extended and will lose part of the picture. */
  croppedSceneNumbers: number[];
}

export type ReframeConfirmationTone =
  /** Ordinary consequence. */
  | "neutral"
  /** Something is lost, but the job can still run. */
  | "caution"
  /** The job cannot run until this is dealt with. */
  | "blocking";

export interface ReframeConfirmationLine {
  tone: ReframeConfirmationTone;
  text: string;
}

export interface ReframeConfirmation {
  title: string;
  lines: ReframeConfirmationLine[];
  /** The label carries the spend, so the button itself says what it costs. */
  confirmLabel: string;
  /** False while any scene is blocked. Confirming would only fail server side. */
  canConfirm: boolean;
}

export function describeReframeConfirmation(input: {
  summary: ReframePlanSummary;
  aspectRatio: "16:9" | "9:16" | "1:1";
  /** The video frame, needed to state the trim the provider's sizes force. */
  frameWidth: number;
  frameHeight: number;
  estimatedCostCents: number;
}): ReframeConfirmation {
  const { summary } = input;
  const lines: ReframeConfirmationLine[] = [];

  if (summary.extendCount > 0)
    lines.push({
      tone: "neutral",
      text:
        summary.extendCount === 1
          ? `1 of ${summary.sceneCount} scenes will have its image extended onto the new canvas, so nothing is cut off.`
          : `${summary.extendCount} of ${summary.sceneCount} scenes will have their images extended onto the new canvas, so nothing is cut off.`,
    });
  else
    lines.push({
      tone: "neutral",
      text: "No scene needs a new image, so nothing will be generated.",
    });

  if (summary.readyCount > 0)
    lines.push({
      tone: "neutral",
      text: `${summary.readyCount} already ${summary.readyCount === 1 ? "has a usable image" : "have usable images"} for this shape and will cost nothing.`,
    });

  if (summary.croppedSceneNumbers.length > 0)
    lines.push({
      tone: "caution",
      text: `${summary.croppedSceneNumbers.length === 1 ? "Scene" : "Scenes"} ${summary.croppedSceneNumbers.join(", ")} ${summary.croppedSceneNumbers.length === 1 ? "was" : "were"} uploaded rather than generated, so ${summary.croppedSceneNumbers.length === 1 ? "it" : "they"} cannot be extended. The edges of the picture will be cropped away.`,
    });

  if (summary.blockedSceneNumbers.length > 0)
    lines.push({
      tone: "blocking",
      text: `Approve an image for ${summary.blockedSceneNumbers.length === 1 ? "scene" : "scenes"} ${summary.blockedSceneNumbers.join(", ")} before reframing.`,
    });

  // The image provider has no 9:16 or 16:9 canvas, so a margin is always
  // trimmed. Saying so is the difference between a known bleed and the
  // surprise of a video cut down both sides.
  const canvas = getSceneImageDimensions(
    getSceneImageSizeForAspectRatio(input.aspectRatio),
  );
  const trim = describeCoverCrop(
    measureCoverCrop({
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      frameWidth: input.frameWidth,
      frameHeight: input.frameHeight,
    }),
  );
  if (trim !== null) lines.push({ tone: "caution", text: trim });

  // Stated even when it is nothing, because "no charge" is itself the answer
  // to the question the dialog exists to answer.
  lines.push({
    tone: "neutral",
    text:
      input.estimatedCostCents > 0
        ? `Estimated cost ${formatUsdCents(input.estimatedCostCents)}, charged for the extended images only.`
        : "This will not cost anything.",
  });

  lines.push({
    tone: "neutral",
    text: "Extending runs first, then the video renders on its own. You can leave this page once it starts.",
  });

  return {
    title: `Reframe this video to ${input.aspectRatio}?`,
    lines,
    confirmLabel:
      input.estimatedCostCents > 0
        ? `Start and spend ${formatUsdCents(input.estimatedCostCents)}`
        : "Start reframe",
    canConfirm: summary.blockedSceneNumbers.length === 0,
  };
}

export interface ReframeCancellation {
  title: string;
  body: string;
  confirmLabel: string;
}

/**
 * Stopping is not undoing. Images already generated are kept and a later run
 * reuses them, so the dialog says that rather than implying a refund.
 */
export function describeReframeCancellation(
  status: "extending" | "rendering",
): ReframeCancellation {
  if (status === "extending")
    return {
      title: "Stop extending images?",
      body: "Images that have already finished are kept, and starting this reframe again will reuse them rather than paying twice. Anything still running is stopped.",
      confirmLabel: "Stop reframe",
    };

  return {
    title: "Stop this render?",
    body: "The extended images are kept, so starting again goes straight to rendering. The part of the video rendered so far is discarded.",
    confirmLabel: "Stop render",
  };
}
