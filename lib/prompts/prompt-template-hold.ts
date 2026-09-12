/**
 * What to do with a job whose prompt version this worker has never heard of.
 *
 * The answer is to wait, not to kill it. A version the worker does not carry
 * almost always means the website deployed first and the worker is minutes
 * behind, so the job becomes runnable again as soon as the worker catches up.
 * Failing it instead throws away a job that was never wrong, and leaves a
 * person to notice and redo it.
 *
 * Waiting has to be bounded by something real. A generation holds a spending
 * reservation that expires after thirty minutes, and the reconciler fails
 * anything still unfinished past that point. So the whole hold has to end
 * comfortably inside that window, or the job dies anyway with a worse
 * explanation than the one this module can give it.
 */

/** Long enough for a deploy, short enough to fit several attempts. */
export const PROMPT_TEMPLATE_HOLD_DELAY_SECONDS = 300;

/**
 * Four waits of five minutes is twenty, against a thirty minute reservation.
 * The remainder is deliberate slack for the final attempt to actually run.
 */
export const MAX_PROMPT_TEMPLATE_HOLD_ATTEMPTS = 4;

export type PromptTemplateHoldDecision =
  | {
      action: "hold";
      /** Which attempt the re-dispatched run will be. */
      attempt: number;
      delaySeconds: number;
    }
  | { action: "giveUp"; safeErrorMessage: string };

export function decidePromptTemplateHold(input: {
  /** How many times this job has already been held. */
  attemptsSoFar: number;
}): PromptTemplateHoldDecision {
  const attempt = input.attemptsSoFar + 1;
  if (attempt > MAX_PROMPT_TEMPLATE_HOLD_ATTEMPTS)
    return {
      action: "giveUp",
      // Names the cause, because the person reading it can fix this one, and
      // "try again" on its own would send them round the same loop.
      safeErrorMessage:
        "This job needs a newer background worker than the one running, and waited without one arriving. Deploy the workers, then generate again.",
    };

  return {
    action: "hold",
    attempt,
    delaySeconds: PROMPT_TEMPLATE_HOLD_DELAY_SECONDS,
  };
}

/** Keeps every held run addressable, so a repeat hold cannot double-dispatch. */
export function createPromptTemplateHoldKey(input: {
  generationId: string;
  attempt: number;
}): string {
  return `prompt-hold-${input.generationId}-${input.attempt}`;
}
