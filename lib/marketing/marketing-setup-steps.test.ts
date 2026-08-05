import { describe, expect, it } from "vitest";

import { selectMarketingSetupSteps } from "@/lib/marketing/marketing-setup-steps";

const FRESH = {
  hasSavedSettings: false,
  brandComplete: false,
  brandRequiredRemaining: 9,
  documentCount: 0,
  scheduleRuleCount: 0,
};

describe("selectMarketingSetupSteps", () => {
  it("marks settings done once a row has been saved", () => {
    expect(selectMarketingSetupSteps(FRESH)[0]?.state).toBe("available");
    expect(
      selectMarketingSetupSteps({ ...FRESH, hasSavedSettings: true })[0]?.state,
    ).toBe("done");
  });

  it("marks the interview done only once it is complete", () => {
    const before = selectMarketingSetupSteps(FRESH);
    const after = selectMarketingSetupSteps({
      ...FRESH,
      brandComplete: true,
      brandRequiredRemaining: 0,
    });
    expect(before[1]?.state).toBe("available");
    expect(after[1]?.state).toBe("done");
  });

  it("says how many required questions are left while the interview is open", () => {
    const step = selectMarketingSetupSteps({
      ...FRESH,
      brandRequiredRemaining: 3,
    })[1];
    expect(step?.description).toContain("3 required questions left");
  });

  it("pluralises a single remaining question correctly", () => {
    const step = selectMarketingSetupSteps({
      ...FRESH,
      brandRequiredRemaining: 1,
    })[1];
    expect(step?.description).toContain("1 required question left");
  });

  it("marks the assets step done once anything has been added", () => {
    expect(selectMarketingSetupSteps(FRESH)[2]?.state).toBe("available");
    expect(
      selectMarketingSetupSteps({ ...FRESH, documentCount: 2 })[2]?.state,
    ).toBe("done");
  });

  it("makes chat and recurring schedules available", () => {
    const steps = selectMarketingSetupSteps(FRESH);
    expect(steps[3]).toMatchObject({
      state: "available",
      href: "/app/marketing/chat",
    });
    expect(steps[4]).toMatchObject({
      state: "available",
      href: "/app/marketing/schedules",
    });
  });

  it("marks recurring schedules done once a rule exists", () => {
    expect(
      selectMarketingSetupSteps({ ...FRESH, scheduleRuleCount: 1 })[4]?.state,
    ).toBe("done");
  });
});
