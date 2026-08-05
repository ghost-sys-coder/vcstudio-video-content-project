import { notFound } from "next/navigation";
import { findMarketingCampaign } from "@/db/repositories/marketing-campaigns.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { CampaignAutomationStatus } from "@/components/marketing/CampaignAutomationStatus";

export default async function CampaignBriefPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const campaign = await findMarketingCampaign({
    workspaceId: context.activeMembership.workspaceId,
    campaignId: (await params).campaignId,
  });
  if (!campaign) notFound();
  return (
    <article className="max-w-3xl space-y-4">
      <CampaignAutomationStatus campaign={campaign} />
      <section>
        <h2 className="font-medium">Key message</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {campaign.keyMessage || "Not set"}
        </p>
      </section>
      <section>
        <h2 className="font-medium">Hypothesis</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {campaign.hypothesis || "Not set"}
        </p>
      </section>
      <section>
        <h2 className="font-medium">Brief</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {campaign.briefPlainText || "Not set"}
        </p>
      </section>
    </article>
  );
}
