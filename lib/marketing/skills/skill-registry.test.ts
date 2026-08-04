import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/budgets/workspace-budget", () => ({
  loadEffectiveWorkspaceBudget: async () => ({
    dailyBudgetCents: 1000,
    monthlyBudgetCents: 10000,
    manualConfirmationThresholdCents: 3,
  }),
}));
import { loadMarketingSkillCatalogue } from "@/lib/marketing/skills/skill-catalogue";
describe("loadMarketingSkillCatalogue", () => {
  it("returns no skills to viewers", async () => {
    expect(
      await loadMarketingSkillCatalogue({
        workspaceId: "ws",
        role: "viewer",
        hasBrandProfile: true,
      }),
    ).toEqual([]);
  });
  it("hides brand-dependent skills before onboarding", async () => {
    const catalogue = await loadMarketingSkillCatalogue({
      workspaceId: "ws",
      role: "editor",
      hasBrandProfile: false,
    });
    expect(catalogue.map((item) => item.key).sort()).toEqual([
      "search_brand_knowledge",
      "train_business_knowledge",
    ]);
  });
  it("marks estimates at the manual threshold for confirmation", async () => {
    const catalogue = await loadMarketingSkillCatalogue({
      workspaceId: "ws",
      role: "owner",
      hasBrandProfile: true,
    });
    expect(
      catalogue.find((item) => item.key === "write_blog_post")
        ?.requiresConfirmation,
    ).toBe(true);
    expect(
      catalogue.find((item) => item.key === "search_brand_knowledge")
        ?.requiresConfirmation,
    ).toBe(false);
  });
});
