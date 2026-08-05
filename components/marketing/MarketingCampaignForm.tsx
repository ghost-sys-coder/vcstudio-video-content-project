import { saveMarketingCampaignAction } from "@/app/(authenticated)/app/marketing/campaigns/actions";
import { Button } from "@/components/ui/button";
import type { MarketingCampaign } from "@/db/schema";
import { NEW_MARKETING_CAMPAIGN_DEFAULTS } from "@/lib/marketing/campaigns/campaign-form-defaults";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export function MarketingCampaignForm({
  campaign,
  automationReady = true,
}: {
  campaign?: MarketingCampaign;
  automationReady?: boolean;
}) {
  return (
    <form action={saveMarketingCampaignAction} className="grid gap-4 max-w-3xl">
      {campaign ? (
        <input name="campaignId" type="hidden" value={campaign.id} />
      ) : null}
      <label className="grid gap-1 text-sm font-medium">
        Campaign name
        <input
          className="h-10 rounded-lg border bg-background px-3"
          defaultValue={campaign?.name ?? NEW_MARKETING_CAMPAIGN_DEFAULTS.name}
          name="name"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium">
          Objective
          <select
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={
              campaign?.objective ?? NEW_MARKETING_CAMPAIGN_DEFAULTS.objective
            }
            name="objective"
          >
            {(
              [
                "awareness",
                "traffic",
                "leads",
                "sales",
                "retention",
                "hiring",
              ] as const
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Traffic
          <select
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={
              campaign?.trafficType ??
              NEW_MARKETING_CAMPAIGN_DEFAULTS.trafficType
            }
            name="trafficType"
          >
            {(["organic", "paid", "both"] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={
              campaign?.status ?? NEW_MARKETING_CAMPAIGN_DEFAULTS.status
            }
            name="status"
          >
            {(
              ["draft", "active", "paused", "completed", "archived"] as const
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Start date
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={
              campaign?.startDate ?? new Date().toISOString().slice(0, 10)
            }
            name="startDate"
            required
            type="date"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          End date
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={campaign?.endDate ?? ""}
            name="endDate"
            type="date"
          />
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Platforms</legend>
        <div className="flex flex-wrap gap-4">
          {SOCIAL_POST_PLATFORMS.map((platform) => (
            <label className="flex items-center gap-2 text-sm" key={platform}>
              <input
                defaultChecked={
                  campaign
                    ? campaign.platforms.includes(platform)
                    : NEW_MARKETING_CAMPAIGN_DEFAULTS.platforms.some(
                        (sample) => sample === platform,
                      )
                }
                name="platforms"
                type="checkbox"
                value={platform}
              />
              {platform}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-medium">
        Key message
        <textarea
          className="min-h-24 rounded-lg border bg-background p-3"
          defaultValue={
            campaign?.keyMessage ?? NEW_MARKETING_CAMPAIGN_DEFAULTS.keyMessage
          }
          name="keyMessage"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Hypothesis
        <textarea
          className="min-h-24 rounded-lg border bg-background p-3"
          defaultValue={
            campaign?.hypothesis ?? NEW_MARKETING_CAMPAIGN_DEFAULTS.hypothesis
          }
          name="hypothesis"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Campaign brief
        <textarea
          className="min-h-40 rounded-lg border bg-background p-3"
          defaultValue={
            campaign?.briefPlainText ??
            NEW_MARKETING_CAMPAIGN_DEFAULTS.briefPlainText
          }
          name="briefPlainText"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          defaultChecked={campaign?.isBranded ?? true}
          name="isBranded"
          type="checkbox"
        />
        Use branded content
      </label>
      {!campaign ? (
        <label className="flex max-w-2xl items-start gap-2 rounded-lg border p-3 text-sm">
          <input
            className="mt-0.5"
            name="confirmAutomationSpend"
            required
            type="checkbox"
          />
          <span>
            Generate campaign content automatically after creation. This runs
            current web research and AI text/image generation against the
            workspace budget. Every result will require owner/editor approval
            before scheduling.
          </span>
        </label>
      ) : null}
      {!campaign && !automationReady ? (
        <p className="text-sm text-destructive">
          Add at least one real competitor under Research before creating a
          campaign. Current, cited research is required for automatic content.
        </p>
      ) : null}
      <Button
        className="w-fit"
        disabled={!campaign && !automationReady}
        type="submit"
      >
        {campaign ? "Save campaign" : "Create campaign"}
      </Button>
    </form>
  );
}
