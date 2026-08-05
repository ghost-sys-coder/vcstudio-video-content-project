import type { MarketingSetupStepState } from "@/components/marketing/MarketingSetupStep";

export type MarketingSetupStep = {
  key: string;
  label: string;
  description: string;
  href?: string;
  state: MarketingSetupStepState;
};

/**
 * The studio's setup checklist.
 *
 * Pure, so the Home page stays a renderer. Every step that a later slice will
 * deliver is listed as `locked` rather than omitted — the studio ships in
 * slices, and an absent step reads as a missing feature where a visible locked
 * one reads as a roadmap.
 *
 * As each slice lands, its step moves from `locked` to `available` here and
 * nowhere else.
 */
export function selectMarketingSetupSteps(input: {
  hasSavedSettings: boolean;
  brandRequiredRemaining: number;
  brandComplete: boolean;
  documentCount: number;
  scheduleRuleCount: number;
}): MarketingSetupStep[] {
  return [
    {
      key: "settings",
      label: "Choose how much the studio does on its own",
      description:
        "Autonomy, approval policy, and a marketing spend ceiling inside the workspace budget.",
      href: "/app/marketing/settings",
      state: input.hasSavedSettings ? "done" : "available",
    },
    {
      key: "brand",
      label: "Tell the studio about the business",
      description: input.brandComplete
        ? "The interview is finished. Revisit it any time — answers are never overwritten."
        : `A short interview covering what you sell, who buys it, and how you sound. ${input.brandRequiredRemaining} required question${
            input.brandRequiredRemaining === 1 ? "" : "s"
          } left.`,
      href: "/app/marketing/brand/onboarding",
      state: input.brandComplete ? "done" : "available",
    },
    {
      key: "assets",
      label: "Upload brand assets and documents",
      description:
        input.documentCount > 0
          ? `${input.documentCount} document${input.documentCount === 1 ? "" : "s"} in the studio's knowledge. Add logos and product shots too, so generated graphics stay on brand.`
          : "Logos, product shots, and anything written that the studio should treat as fact.",
      href: "/app/marketing/assets",
      state: input.documentCount > 0 ? "done" : "available",
    },
    {
      key: "chat",
      label: "Ask the studio for work",
      description: "A conversation with skills — type / to see what it can do.",
      href: "/app/marketing/chat",
      state: "available",
    },
    {
      key: "schedule",
      label: "Put content on a schedule",
      description:
        input.scheduleRuleCount > 0
          ? `${input.scheduleRuleCount} recurring rule${input.scheduleRuleCount === 1 ? "" : "s"} prepared. Rules run only while autonomy is Assisted.`
          : "Recurring rules that draft content without being asked each time.",
      href: "/app/marketing/schedules",
      state: input.scheduleRuleCount > 0 ? "done" : "available",
    },
  ];
}
