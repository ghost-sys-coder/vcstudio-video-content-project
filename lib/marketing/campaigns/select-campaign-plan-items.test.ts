import { describe, expect, it } from "vitest";
import { selectCampaignPlanItems } from "@/lib/marketing/campaigns/select-campaign-plan-items";

const item = (
  kind: "social_post" | "graphic" | "media_story",
  platform: "instagram" | "linkedin",
  mediaAssetId: string | null = null,
) => ({
  conceptKey: `${kind}-concept`,
  connectionId:
    platform === "instagram"
      ? "11111111-1111-4111-8111-111111111112"
      : "11111111-1111-4111-8111-111111111113",
  platform,
  kind,
  title: `${kind}-${platform}`,
  body: "Usable campaign copy",
  scheduledDayOffset: 0,
  mediaAssetId,
  visualDirection: "Clean editorial composition",
  researchSnapshotIds: ["11111111-1111-4111-8111-111111111111"],
  researchRationale: "Grounded in cited research",
});

describe("selectCampaignPlanItems", () => {
  it("caps generated graphics per platform and video drafts per campaign", () => {
    const selected = selectCampaignPlanItems({
      items: [
        item("graphic", "instagram"),
        item("graphic", "instagram"),
        item("graphic", "linkedin"),
        item("media_story", "instagram"),
        item("media_story", "linkedin"),
        item("social_post", "instagram"),
      ],
      platforms: ["instagram", "linkedin"],
      maximumItems: 10,
    });
    expect(selected.filter((value) => value.kind === "graphic")).toHaveLength(
      2,
    );
    expect(
      selected.filter((value) => value.kind === "media_story"),
    ).toHaveLength(1);
    expect(selected).toHaveLength(4);
  });
});
