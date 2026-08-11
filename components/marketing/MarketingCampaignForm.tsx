"use client";

import { useState } from "react";
import Link from "next/link";
import { saveMarketingCampaignAction } from "@/app/(authenticated)/app/marketing/campaigns/actions";
import { PlatformMarkIcon } from "@/components/brand/PlatformMarkIcon";
import { Button } from "@/components/ui/button";
import type {
  ContentPlatform,
  MarketingCampaign,
  MarketingBrandProfile,
} from "@/db/schema";
import type { PlatformConnectionSummary } from "@/db/repositories/publishing.repository";
import { NEW_MARKETING_CAMPAIGN_DEFAULTS } from "@/lib/marketing/campaigns/campaign-form-defaults";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export function MarketingCampaignForm({
  campaign,
  automationReady = true,
  brandProfile,
  connections,
  selectedConnectionIds = [],
}: {
  campaign?: MarketingCampaign;
  automationReady?: boolean;
  brandProfile: Pick<MarketingBrandProfile, "id" | "businessName"> | null;
  connections: PlatformConnectionSummary[];
  selectedConnectionIds?: string[];
}) {
  const activeConnections = connections.filter(
    (connection) => connection.status === "active",
  );
  const [platforms, setPlatforms] = useState<ContentPlatform[]>([
    ...(campaign?.platforms ?? NEW_MARKETING_CAMPAIGN_DEFAULTS.platforms),
  ]);
  const [connectionIds, setConnectionIds] = useState<string[]>(
    selectedConnectionIds,
  );

  function togglePlatform(platform: ContentPlatform, checked: boolean) {
    setPlatforms((current) =>
      checked
        ? [...new Set([...current, platform])]
        : current.filter((value) => value !== platform),
    );
    if (!checked)
      setConnectionIds((current) =>
        current.filter(
          (id) =>
            activeConnections.find((connection) => connection.id === id)
              ?.platform !== platform,
        ),
      );
  }

  return (
    <form action={saveMarketingCampaignAction} className="grid max-w-3xl gap-5">
      {campaign ? (
        <input name="campaignId" type="hidden" value={campaign.id} />
      ) : null}
      <input name="trafficType" type="hidden" value="organic" />
      <fieldset className="grid gap-2 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Business</legend>
        {brandProfile ? (
          <label className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <input
              defaultChecked
              name="brandProfileId"
              required
              type="radio"
              value={brandProfile.id}
            />
            <span>
              <strong>{brandProfile.businessName || "Workspace brand"}</strong>
              <br />
              <span className="text-muted-foreground">
                Campaign content uses this brand profile and its knowledge.
              </span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-destructive">
            Complete the{" "}
            <Link className="underline" href="/app/marketing/brand">
              brand profile
            </Link>{" "}
            before creating a campaign.
          </p>
        )}
      </fieldset>
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
      <input name="status" type="hidden" value={campaign?.status ?? "draft"} />
      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          Platforms and accounts
        </legend>
        <p className="text-sm text-muted-foreground">
          Choose platforms first, then one or more connected accounts on each
          platform.
        </p>
        <div className="flex flex-wrap gap-3">
          {SOCIAL_POST_PLATFORMS.map((platform) => (
            <label className="flex items-center gap-2 text-sm" key={platform}>
              <input
                checked={platforms.includes(platform)}
                name="platforms"
                onChange={(event) =>
                  togglePlatform(platform, event.target.checked)
                }
                type="checkbox"
                value={platform}
              />
              <PlatformMarkIcon className="size-4" platform={platform} />
              {platform}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {platforms.map((platform) => {
            const matching = activeConnections.filter(
              (connection) => connection.platform === platform,
            );
            return (
              <div className="rounded-lg bg-muted/35 p-3" key={platform}>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <PlatformMarkIcon className="size-4" platform={platform} />
                  {platform}
                </p>
                {matching.length ? (
                  <div className="grid gap-2">
                    {matching.map((connection) => (
                      <label
                        className="flex items-center gap-2 text-sm"
                        key={connection.id}
                      >
                        <input
                          checked={connectionIds.includes(connection.id)}
                          name="connectionIds"
                          onChange={(event) =>
                            setConnectionIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, connection.id])]
                                : current.filter((id) => id !== connection.id),
                            )
                          }
                          type="checkbox"
                          value={connection.id}
                        />
                        {connection.externalAccountName ||
                          connection.externalAccountId}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-destructive">
                    No active account.{" "}
                    <Link className="underline" href="/app/social/accounts">
                      Connect one
                    </Link>
                    .
                  </p>
                )}
              </div>
            );
          })}
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
            Generate campaign content automatically after creation. AI
            generation uses only the accounts selected above and every result
            requires approval before publishing.
          </span>
        </label>
      ) : null}
      {!campaign && !automationReady ? (
        <p className="text-sm text-destructive">
          Add at least one real competitor under Research before creating a
          campaign.
        </p>
      ) : null}
      <Button
        className="w-fit"
        disabled={
          !brandProfile ||
          connectionIds.length === 0 ||
          (!campaign && !automationReady)
        }
        type="submit"
      >
        {campaign ? "Save campaign" : "Create campaign"}
      </Button>
    </form>
  );
}
