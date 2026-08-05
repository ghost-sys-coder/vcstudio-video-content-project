import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const userSkills = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("@/lib/budgets/workspace-budget", () => ({
  loadEffectiveWorkspaceBudget: async () => ({
    dailyBudgetCents: 1000,
    monthlyBudgetCents: 10000,
    manualConfirmationThresholdCents: 3,
  }),
}));
vi.mock("@/db/repositories/marketing-skills.repository", () => ({
  listMarketingSkills: async () => userSkills.rows,
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
      "create_video_draft",
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

  it("offers every supported platform and usable defaults for social graphics", async () => {
    const catalogue = await loadMarketingSkillCatalogue({
      workspaceId: "ws",
      role: "editor",
      hasBrandProfile: true,
    });
    const graphic = catalogue.find(
      (item) => item.key === "create_social_graphic",
    );
    expect(
      graphic?.inputFields.find((field) => field.key === "platform")?.options,
    ).toEqual([
      "linkedin",
      "twitter",
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
    ]);
    expect(
      graphic?.inputFields.find((field) => field.key === "topic")?.defaultValue,
    ).toBeTruthy();
    expect(
      graphic?.inputFields.find((field) => field.key === "visualDirection")
        ?.defaultValue,
    ).toBeTruthy();
  });

  it("provides usable starting content for every editable text field", async () => {
    const catalogue = await loadMarketingSkillCatalogue({
      workspaceId: "ws",
      role: "owner",
      hasBrandProfile: true,
    });
    const editableFields = catalogue.flatMap((skill) =>
      skill.inputFields
        .filter((field) => field.type === "text" || field.type === "longtext")
        .map((field) => ({ skillKey: skill.key, field })),
    );
    expect(editableFields.length).toBeGreaterThan(0);
    for (const { skillKey, field } of editableFields) {
      expect(field.defaultValue, `${skillKey}.${field.key}`).toBeTruthy();
      expect(field.defaultValue?.trim(), `${skillKey}.${field.key}`).not.toBe(
        "",
      );
      expect(field.defaultValue, `${skillKey}.${field.key}`).not.toMatch(
        /^Example:/,
      );
    }
  });

  it("adds enabled workspace skills to owner and editor catalogues", async () => {
    userSkills.rows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        slug: "weekly-founder-note",
        name: "Weekly founder note",
        description: "Write a concise weekly note for business owners.",
        instructions: "Summarize one useful lesson and one next action.",
        baseSkillKey: "write_email",
        inputFields: [
          {
            key: "topic",
            label: "Topic",
            type: "text",
            required: true,
            defaultValue: "A lesson from this week's client work",
          },
        ],
        defaultPlatform: null,
        defaultContentKind: "email",
        isEnabled: true,
        version: 1,
        createdByUserId: "33333333-3333-4333-8333-333333333333",
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    for (const role of ["owner", "editor"] as const) {
      const catalogue = await loadMarketingSkillCatalogue({
        workspaceId: "ws",
        role,
        hasBrandProfile: true,
      });
      expect(catalogue.some((item) => item.key === "weekly-founder-note")).toBe(
        true,
      );
    }
    userSkills.rows = [];
  });
});
