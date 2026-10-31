import { describe, expect, it } from "vitest";
import {
  getLegacyConnectionsRedirect,
  WORKSPACE_CONNECTIONS_PATH,
} from "@/lib/publishing/connections-navigation";
import { connectionOAuthQuerySchema } from "@/lib/schemas/connection-oauth";

describe("connection navigation", () => {
  it("forwards legacy OAuth results to the shared accounts page", () => {
    expect(
      getLegacyConnectionsRedirect({
        facebook: "expired",
        youtube: "connected",
      }),
    ).toBe(`${WORKSPACE_CONNECTIONS_PATH}?facebook=expired&youtube=connected`);
  });

  it("does not redirect ordinary workspace settings requests", () => {
    expect(getLegacyConnectionsRedirect({})).toBeNull();
  });

  it("drops unknown status text, repeated parameters and unrelated query data", () => {
    expect(
      getLegacyConnectionsRedirect({
        youtube: ["connected", "failed"],
        facebook: "provider error text",
        linkedin: "connected",
        redirect: "https://untrusted.example",
        code: "must-not-forward",
      }),
    ).toBe(`${WORKSPACE_CONNECTIONS_PATH}?linkedin=connected`);
    expect(getLegacyConnectionsRedirect({ x: "arbitrary" })).toBeNull();
  });

  it("normalizes missing and invalid callback statuses without breaking the page", () => {
    expect(
      connectionOAuthQuerySchema.parse({ youtube: "connected", instagram: [] }),
    ).toEqual({
      facebook: null,
      instagram: null,
      linkedin: null,
      tiktok: null,
      x: null,
      youtube: "connected",
    });
  });
});
