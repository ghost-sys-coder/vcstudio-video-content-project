import { describe, expect, it } from "vitest";
import { resolveMarketingConnectionHealth } from "@/lib/marketing/integrations/connection-health";

const now = new Date("2026-08-09T12:00:00.000Z");

describe("resolveMarketingConnectionHealth", () => {
  it("marks an active connection with a lapsed token as expired", () => {
    expect(
      resolveMarketingConnectionHealth(
        {
          status: "active",
          accessTokenExpiresAt: new Date("2026-08-09T11:59:59.000Z"),
        },
        now,
      ),
    ).toBe("expired");
  });

  it("keeps an active connection healthy when its token has not expired", () => {
    expect(
      resolveMarketingConnectionHealth(
        {
          status: "active",
          accessTokenExpiresAt: new Date("2026-08-09T12:00:01.000Z"),
        },
        now,
      ),
    ).toBe("active");
  });

  it("treats a token without an expiry as active", () => {
    expect(
      resolveMarketingConnectionHealth(
        { status: "active", accessTokenExpiresAt: null },
        now,
      ),
    ).toBe("active");
  });

  it("preserves an explicit revoked state", () => {
    expect(
      resolveMarketingConnectionHealth(
        {
          status: "revoked",
          accessTokenExpiresAt: new Date("2026-08-10T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe("revoked");
  });
});
