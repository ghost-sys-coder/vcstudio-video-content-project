import { describe, expect, it } from "vitest";
import { canTransitionMarketingContent } from "@/lib/marketing/content/content-status";
describe("marketing content transitions", () => {
  it("allows the review and handoff path", () => {
    expect(canTransitionMarketingContent("draft", "needs_review")).toBe(true);
    expect(canTransitionMarketingContent("needs_review", "approved")).toBe(
      true,
    );
    expect(canTransitionMarketingContent("approved", "scheduled")).toBe(true);
  });
  it("rejects skipping review and terminal rewrites", () => {
    expect(canTransitionMarketingContent("draft", "approved")).toBe(false);
    expect(canTransitionMarketingContent("published", "draft")).toBe(false);
    expect(canTransitionMarketingContent("archived", "needs_review")).toBe(
      false,
    );
  });
});
