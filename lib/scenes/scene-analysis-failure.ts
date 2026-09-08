/**
 * Failure categories shared between the scene-analysis worker and the review
 * interface. Kept out of the worker module so a React component can name a
 * category without pulling Trigger.dev and server-only providers into the
 * client bundle.
 */

/** Provider output was produced and billed, then rejected by fidelity validation. */
export const NARRATION_FIDELITY_ERROR_CATEGORY = "narration_fidelity";
