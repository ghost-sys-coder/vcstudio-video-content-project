import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import {
  findMarketingCampaign,
  listMarketingCampaignContent,
} from "@/db/repositories/marketing-campaigns.repository";
import { createAdCreativeCsv } from "@/lib/marketing/campaigns/ad-creative-csv";
import { requireCapability } from "@/lib/policies/workspace-policy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; campaignId: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const params = await context.params;
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: params.workspaceId,
    });
    requireCapability(membership.role, "approveMarketingContent");
    const input = {
      workspaceId: params.workspaceId,
      campaignId: params.campaignId,
    };
    const [campaign, items] = await Promise.all([
      findMarketingCampaign(input),
      listMarketingCampaignContent(input),
    ]);
    if (!campaign)
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new NextResponse(createAdCreativeCsv(items), {
      headers: {
        "content-disposition": `attachment; filename="${campaign.id}-ads.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "You cannot export this campaign." },
      { status: 403 },
    );
  }
}
