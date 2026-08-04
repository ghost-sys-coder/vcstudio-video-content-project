import { describe, expect, it } from "vitest";
import { hasRunningMarketingWork } from "@/lib/marketing/chat/tool-call-status";

describe("hasRunningMarketingWork", () => {
  it("is true while pending or running work exists", () => {
    expect(hasRunningMarketingWork([{ status: "pending" }])).toBe(true);
    expect(hasRunningMarketingWork([{ status: "running" }])).toBe(true);
  });

  it("stops once every tool call is terminal", () => {
    expect(
      hasRunningMarketingWork([
        { status: "succeeded" },
        { status: "failed" },
        { status: "cancelled" },
      ]),
    ).toBe(false);
  });
});
