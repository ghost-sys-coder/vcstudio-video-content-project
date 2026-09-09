import {
  canChannelPublish,
  channelAvailabilityMessage,
  resolveChannelPublishAvailability,
  type ChannelPublishAvailability,
} from "@/lib/channels/channel-availability";
import type { ChannelProfileWithConnection } from "@/db/repositories/channel-profiles.repository";

export interface ChannelProfileView {
  id: string;
  name: string;
  slug: string;
  platform: string;
  description: string;
  audienceDescription: string;
  toneDescription: string;
  language: string;
  cadence: string;
  timeZone: string;
  defaultAspectRatio: string | null;
  defaultMaximumBudgetCents: number | null;
  externalAccountId: string | null;
  connectedAccountName: string | null;
  availability: ChannelPublishAvailability;
  availabilityMessage: string;
  canPublish: boolean;
  status: "active" | "archived";
  projectCount: number;
}

/**
 * Shapes a profile plus its resolved grant for the interface, and never leaks
 * a token, scope string or connection secret — only the account's display name.
 */
export function buildChannelProfileView(input: {
  row: ChannelProfileWithConnection;
  projectCount: number;
}): ChannelProfileView {
  const { profile, connection } = input.row;
  const availability = resolveChannelPublishAvailability({
    status: connection?.status ?? null,
    hasExternalAccount: Boolean(profile.externalAccountId),
  });
  return {
    id: profile.id,
    name: profile.name,
    slug: profile.slug,
    platform: profile.platform,
    description: profile.description,
    audienceDescription: profile.audienceDescription,
    toneDescription: profile.toneDescription,
    language: profile.language,
    cadence: profile.cadence,
    timeZone: profile.timeZone,
    defaultAspectRatio: profile.defaultAspectRatio,
    defaultMaximumBudgetCents: profile.defaultMaximumBudgetCents,
    externalAccountId: profile.externalAccountId,
    connectedAccountName: connection?.externalAccountName || null,
    availability,
    availabilityMessage: channelAvailabilityMessage(availability),
    canPublish: canChannelPublish(availability),
    status: profile.status,
    projectCount: input.projectCount,
  };
}
