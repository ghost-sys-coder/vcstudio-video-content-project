/**
 * Whether a channel can currently publish, kept separate from whether it
 * exists.
 *
 * The distinction is the point of the whole slice: revoking OAuth must block
 * the publication action without erasing the channel, its defaults, or the
 * projects produced for it. Every state below except `ready` blocks publishing
 * while leaving production identity fully intact.
 */
export type ChannelPublishAvailability =
  "ready" | "never_connected" | "disconnected" | "expired" | "revoked";

export interface ChannelConnectionFacts {
  /** Null when no live grant matches this channel's external account. */
  status: "active" | "expired" | "revoked" | null;
  hasExternalAccount: boolean;
}

export function resolveChannelPublishAvailability(
  facts: ChannelConnectionFacts,
): ChannelPublishAvailability {
  if (!facts.hasExternalAccount) return "never_connected";
  // An external account with no matching grant means the connection row is gone
  // — deleted or belonging to a workspace that no longer has it. The channel is
  // still a real channel; it just cannot publish.
  if (facts.status === null) return "disconnected";
  if (facts.status === "expired") return "expired";
  if (facts.status === "revoked") return "revoked";
  return "ready";
}

export function canChannelPublish(
  availability: ChannelPublishAvailability,
): boolean {
  return availability === "ready";
}

const MESSAGES: Record<ChannelPublishAvailability, string> = {
  ready: "Connected and ready to publish.",
  never_connected:
    "This channel has never been connected. Connect the account to publish to it.",
  disconnected:
    "The account for this channel is no longer connected. Reconnect it to publish; the channel and its projects are unchanged.",
  expired:
    "The connection for this channel has expired. Reconnect the account to publish again.",
  revoked:
    "Access to this channel was revoked. Reconnect the account to publish again.",
};

export function channelAvailabilityMessage(
  availability: ChannelPublishAvailability,
): string {
  return MESSAGES[availability];
}
