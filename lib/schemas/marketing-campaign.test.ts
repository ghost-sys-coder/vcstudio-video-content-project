import { describe, expect, it } from "vitest";
import { marketingCampaignMutationSchema } from "@/lib/schemas/marketing-campaign";

const valid = {
  name: "Ugandan launch",
  objective: "awareness",
  status: "draft",
  startDate: "2026-08-12",
  endDate: "",
  brandProfileId: "11111111-1111-4111-8111-111111111111",
  connectionIds: ["11111111-1111-4111-8111-111111111112"],
  platforms: ["instagram"],
  keyMessage: "A clear message",
  hypothesis: "The audience will respond",
  briefPlainText: "Campaign brief",
  isBranded: true,
};

describe("marketingCampaignMutationSchema", () => {
  it("requires an exact business and at least one account", () => {
    expect(marketingCampaignMutationSchema.safeParse(valid).success).toBe(true);
    expect(
      marketingCampaignMutationSchema.safeParse({ ...valid, connectionIds: [] })
        .success,
    ).toBe(false);
  });

  it("forces new campaign traffic to the organic default", () => {
    const result = marketingCampaignMutationSchema.parse(valid);
    expect(result.trafficType).toBe("organic");
  });
});
