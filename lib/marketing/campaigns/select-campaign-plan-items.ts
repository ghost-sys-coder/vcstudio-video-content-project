import type { CampaignContentPlan } from "@/lib/schemas/marketing-campaign-automation";

export function selectCampaignPlanItems(input: {
  items: CampaignContentPlan["items"];
  platforms: readonly string[];
  maximumItems: number;
}) {
  const platforms = new Set(input.platforms);
  const graphicPlatforms = new Set<string>();
  let videoDraftSelected = false;
  return input.items
    .filter((item) => {
      if (!platforms.has(item.platform)) return false;
      if (item.kind === "graphic") {
        if (graphicPlatforms.has(item.platform)) return false;
        graphicPlatforms.add(item.platform);
      }
      if (item.kind === "media_story" && item.mediaAssetId === null) {
        if (videoDraftSelected) return false;
        videoDraftSelected = true;
      }
      return true;
    })
    .slice(0, input.maximumItems);
}
