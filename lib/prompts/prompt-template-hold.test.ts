import { describe, expect, it } from "vitest";
import {
  createPromptTemplateHoldKey,
  decidePromptTemplateHold,
  MAX_PROMPT_TEMPLATE_HOLD_ATTEMPTS,
  PROMPT_TEMPLATE_HOLD_DELAY_SECONDS,
} from "@/lib/prompts/prompt-template-hold";

describe("waiting for a worker that understands the job", () => {
  it("holds the first time rather than failing", () => {
    const decision = decidePromptTemplateHold({ attemptsSoFar: 0 });
    expect(decision.action).toBe("hold");
    if (decision.action === "hold") {
      expect(decision.attempt).toBe(1);
      expect(decision.delaySeconds).toBe(PROMPT_TEMPLATE_HOLD_DELAY_SECONDS);
    }
  });

  it("keeps holding up to the limit", () => {
    for (
      let already = 0;
      already < MAX_PROMPT_TEMPLATE_HOLD_ATTEMPTS;
      already++
    )
      expect(decidePromptTemplateHold({ attemptsSoFar: already }).action).toBe(
        "hold",
      );
  });

  it("gives up once the limit is passed", () => {
    const decision = decidePromptTemplateHold({
      attemptsSoFar: MAX_PROMPT_TEMPLATE_HOLD_ATTEMPTS,
    });
    expect(decision.action).toBe("giveUp");
  });

  it("names the remedy when it gives up, since the reader can fix this one", () => {
    const decision = decidePromptTemplateHold({ attemptsSoFar: 99 });
    if (decision.action !== "giveUp") throw new Error("expected giveUp");
    expect(decision.safeErrorMessage).toContain("Deploy the workers");
  });
});

describe("the hold has to end before the reservation does", () => {
  it("fits inside the thirty minute reservation with room to spare", () => {
    // A generation holds a spending reservation that expires after thirty
    // minutes, and the reconciler fails anything unfinished past it. A hold
    // that outlived that would kill the job with a worse explanation than the
    // one this module gives it.
    const totalSeconds =
      PROMPT_TEMPLATE_HOLD_DELAY_SECONDS * MAX_PROMPT_TEMPLATE_HOLD_ATTEMPTS;
    expect(totalSeconds).toBeLessThan(25 * 60);
  });

  it("waits long enough for a deploy to actually happen", () => {
    expect(PROMPT_TEMPLATE_HOLD_DELAY_SECONDS).toBeGreaterThanOrEqual(60);
  });
});

describe("addressing each held run", () => {
  it("gives every attempt its own key, so a repeat cannot double-dispatch", () => {
    expect(
      createPromptTemplateHoldKey({ generationId: "gen-1", attempt: 1 }),
    ).not.toBe(
      createPromptTemplateHoldKey({ generationId: "gen-1", attempt: 2 }),
    );
  });

  it("keeps two generations apart at the same attempt", () => {
    expect(
      createPromptTemplateHoldKey({ generationId: "gen-1", attempt: 1 }),
    ).not.toBe(
      createPromptTemplateHoldKey({ generationId: "gen-2", attempt: 1 }),
    );
  });
});
