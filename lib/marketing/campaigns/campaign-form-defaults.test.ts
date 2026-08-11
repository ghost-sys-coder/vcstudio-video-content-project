import { describe, expect, it } from "vitest";
import { marketingCampaignInputSchema } from "@/lib/schemas/marketing-campaign";
import { NEW_MARKETING_CAMPAIGN_DEFAULTS } from "@/lib/marketing/campaigns/campaign-form-defaults";

describe("NEW_MARKETING_CAMPAIGN_DEFAULTS", () => {
  it("provides a complete, immediately usable campaign sample", () => {
    expect(
      marketingCampaignInputSchema.safeParse({
        ...NEW_MARKETING_CAMPAIGN_DEFAULTS,
        startDate: "2026-08-05",
        endDate: "",
        brandProfileId: "11111111-1111-4111-8111-111111111111",
        connectionIds: ["11111111-1111-4111-8111-111111111112"],
        isBranded: true,
      }).success,
    ).toBe(true);
  });
});
