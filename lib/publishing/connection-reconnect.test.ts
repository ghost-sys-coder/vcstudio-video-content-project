import { describe, expect, it } from "vitest";
import { getReconnectAuthorizePath } from "@/lib/publishing/connection-reconnect";

const allEnabled = { videoPublishingEnabled: true, socialPostingEnabled: true };

describe("reconnect authorize path", () => {
  it.each([
    ["youtube", "UC123", "/api/youtube/authorize"],
    ["facebook", "page-1", "/api/facebook/authorize"],
    ["instagram", "ig-1", "/api/instagram/authorize"],
    ["tiktok", "open-id", "/api/tiktok/authorize"],
    ["twitter", "x-1", "/api/x/authorize"],
    ["linkedin", "urn:li:person:abc", "/api/linkedin/authorize"],
    ["linkedin", "abc", "/api/linkedin/authorize"],
    ["linkedin", "urn:li:organization:42", "/api/linkedin/pages/authorize"],
  ] as const)(
    "sends a %s connection (%s) to %s",
    (platform, externalAccountId, path) => {
      for (const status of ["active", "expired"] as const)
        expect(
          getReconnectAuthorizePath(
            { platform, externalAccountId, status },
            allEnabled,
          ),
        ).toBe(path);
    },
  );

  it("never offers a reconnect for a revoked connection", () => {
    expect(
      getReconnectAuthorizePath(
        { platform: "youtube", externalAccountId: "UC1", status: "revoked" },
        allEnabled,
      ),
    ).toBeNull();
  });

  it("does not route a TikTok sandbox connection through the production app", () => {
    expect(
      getReconnectAuthorizePath(
        {
          platform: "tiktok",
          externalAccountId: "open-id",
          isSandbox: true,
          status: "expired",
        },
        allEnabled,
      ),
    ).toBeNull();
  });

  it("follows the flag that gates each authorize route", () => {
    const videoOff = {
      videoPublishingEnabled: false,
      socialPostingEnabled: true,
    };
    const socialOff = {
      videoPublishingEnabled: true,
      socialPostingEnabled: false,
    };
    const connection = (
      platform:
        | "youtube"
        | "facebook"
        | "instagram"
        | "tiktok"
        | "linkedin"
        | "twitter",
    ) => ({
      platform,
      externalAccountId: "id-1",
      status: "expired" as const,
    });

    for (const platform of [
      "youtube",
      "facebook",
      "instagram",
      "tiktok",
    ] as const) {
      expect(
        getReconnectAuthorizePath(connection(platform), videoOff),
      ).toBeNull();
      expect(
        getReconnectAuthorizePath(connection(platform), socialOff),
      ).not.toBeNull();
    }
    for (const platform of ["linkedin", "twitter"] as const) {
      expect(
        getReconnectAuthorizePath(connection(platform), socialOff),
      ).toBeNull();
      expect(
        getReconnectAuthorizePath(connection(platform), videoOff),
      ).not.toBeNull();
    }
  });
});
