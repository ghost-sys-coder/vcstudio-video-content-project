import { describe, expect, it } from "vitest";
import {
  canStartCampaignAutomation,
  getCampaignAutomationPresentation,
} from "@/lib/marketing/campaigns/campaign-automation-presentation";

describe("campaign automation presentation", () => {
  it("never presents an empty legacy campaign as completed", () => {
    const result = getCampaignAutomationPresentation({
      status: "completed",
      completedAt: null,
      contentCount: 0,
    });
    expect(result).toMatchObject({
      completed: false,
      canStart: true,
      label: "not started",
    });
    expect(
      canStartCampaignAutomation({ status: "completed", completedAt: null }),
    ).toBe(true);
  });

  it("presents a completed run only when generated content exists", () => {
    expect(
      getCampaignAutomationPresentation({
        status: "completed",
        completedAt: new Date("2026-08-05T00:00:00Z"),
        contentCount: 4,
      }),
    ).toMatchObject({ completed: true, canStart: false, label: "completed" });
  });
});
