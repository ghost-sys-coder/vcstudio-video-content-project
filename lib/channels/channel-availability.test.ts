import { describe, expect, it } from "vitest";
import {
  canChannelPublish,
  channelAvailabilityMessage,
  resolveChannelPublishAvailability,
  type ChannelPublishAvailability,
} from "@/lib/channels/channel-availability";

describe("resolveChannelPublishAvailability", () => {
  it("is ready only when a live grant matches the channel", () => {
    expect(
      resolveChannelPublishAvailability({
        status: "active",
        hasExternalAccount: true,
      }),
    ).toBe("ready");
  });

  it("reports a channel that has never been connected", () => {
    expect(
      resolveChannelPublishAvailability({
        status: null,
        hasExternalAccount: false,
      }),
    ).toBe("never_connected");
  });

  it("reports a channel whose connection row is gone as disconnected", () => {
    // The identity survives; only the grant is missing.
    expect(
      resolveChannelPublishAvailability({
        status: null,
        hasExternalAccount: true,
      }),
    ).toBe("disconnected");
  });

  it("distinguishes expiry from revocation", () => {
    expect(
      resolveChannelPublishAvailability({
        status: "expired",
        hasExternalAccount: true,
      }),
    ).toBe("expired");
    expect(
      resolveChannelPublishAvailability({
        status: "revoked",
        hasExternalAccount: true,
      }),
    ).toBe("revoked");
  });

  it("ignores a stale grant status when no account was ever recorded", () => {
    // Defensive: a profile with no external account cannot be publishable even
    // if some unrelated active connection exists on the workspace.
    expect(
      resolveChannelPublishAvailability({
        status: "active",
        hasExternalAccount: false,
      }),
    ).toBe("never_connected");
  });
});

describe("canChannelPublish", () => {
  it("permits publishing only in the ready state", () => {
    const states: ChannelPublishAvailability[] = [
      "ready",
      "never_connected",
      "disconnected",
      "expired",
      "revoked",
    ];
    expect(states.filter(canChannelPublish)).toEqual(["ready"]);
  });
});

describe("channelAvailabilityMessage", () => {
  it("tells the creator their channel and projects are intact", () => {
    expect(channelAvailabilityMessage("disconnected")).toContain(
      "projects are unchanged",
    );
  });

  it("gives every state an actionable message", () => {
    const states: ChannelPublishAvailability[] = [
      "ready",
      "never_connected",
      "disconnected",
      "expired",
      "revoked",
    ];
    for (const state of states)
      expect(channelAvailabilityMessage(state).length).toBeGreaterThan(10);
  });
});
