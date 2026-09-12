export interface ReframeProgressInput {
  status: "extending" | "rendering" | "completed" | "failed" | "cancelled";
  /** How many stills this job set out to extend. */
  totalExtensions: number;
  /** Extensions that have landed. */
  succeededExtensions: number;
  /** Extensions that will not land, and whose scenes are cropped instead. */
  failedExtensions: number;
  /** The render's own reported percentage, once there is a render. */
  renderPercent: number | null;
}

export interface ReframeProgress {
  /** The phase, in the creator's words. */
  label: string;
  /** What is happening inside that phase, or null when there is nothing to add. */
  detail: string | null;
  /**
   * A real measurement or nothing. Never an estimate spanning both phases:
   * extending N images and rendering a video take unrelated amounts of time,
   * so a single bar across the two would be invented rather than measured.
   */
  percent: number | null;
}

export function describeReframeProgress(
  input: ReframeProgressInput,
): ReframeProgress {
  const resolved = input.succeededExtensions + input.failedExtensions;

  if (input.status === "extending") {
    if (input.totalExtensions === 0)
      return {
        label: "Preparing",
        detail: "Nothing needs extending, so the render starts next.",
        percent: null,
      };
    return {
      label: "Extending images",
      detail:
        input.failedExtensions > 0
          ? `${input.succeededExtensions} of ${input.totalExtensions} done, ${input.failedExtensions} could not be extended`
          : `${input.succeededExtensions} of ${input.totalExtensions} done`,
      // How many are resolved, which is measured rather than guessed. It
      // covers this phase only, which the label makes plain.
      percent: Math.round((resolved / input.totalExtensions) * 100),
    };
  }

  if (input.status === "rendering")
    return {
      label: "Rendering",
      detail:
        input.totalExtensions > 0
          ? `${input.succeededExtensions} of ${input.totalExtensions} images extended`
          : null,
      percent: input.renderPercent,
    };

  if (input.status === "completed")
    return { label: "Finished", detail: null, percent: 100 };

  if (input.status === "cancelled")
    return { label: "Cancelled", detail: null, percent: null };

  return { label: "Failed", detail: null, percent: null };
}
