import { describe, expect, it } from "vitest";
import { PLATFORM_ROUTE_SEGMENTS } from "@/lib/platforms/platform-routes";
import {
  POST_ONLY_PLATFORMS,
  selectConnectablePostPlatforms,
} from "@/lib/social/select-connectable-post-platforms";

describe("selectConnectablePostPlatforms", () => {
  it("offers every post-only platform when none is connected", () => {
    expect(
      selectConnectablePostPlatforms([]).map((entry) => entry.platform),
    ).toEqual([...POST_ONLY_PLATFORMS]);
  });

  it("stops offering a platform once it is connected", () => {
    const result = selectConnectablePostPlatforms(["linkedin"]);
    // A standing "Connect LinkedIn" beside a connected LinkedIn account reads as
    // a broken connection, not as an invitation to add a second one.
    expect(result.map((entry) => entry.platform)).toEqual(["twitter"]);
  });

  it("returns nothing when both are connected", () => {
    expect(selectConnectablePostPlatforms(["twitter", "linkedin"])).toEqual([]);
  });

  it("ignores video platforms, which the channel picker already offers", () => {
    // Offering YouTube a second time here would give one account two front doors.
    expect(
      selectConnectablePostPlatforms(["youtube", "facebook"]).map(
        (entry) => entry.platform,
      ),
    ).toEqual([...POST_ONLY_PLATFORMS]);
  });

  it("labels X as X and links it to its own route segment", () => {
    const x = selectConnectablePostPlatforms([]).find(
      (entry) => entry.platform === "twitter",
    );
    expect(x?.label).toBe("X");
    // Stored `twitter`, routed `x` — the link must follow the route segment, or
    // it 404s before the user ever reaches X.
    expect(x?.href).toBe("/api/x/authorize");
    expect(PLATFORM_ROUTE_SEGMENTS.twitter).toBe("x");
  });

  it("links LinkedIn to its own unchanged path", () => {
    const linkedin = selectConnectablePostPlatforms([]).find(
      (entry) => entry.platform === "linkedin",
    );
    expect(linkedin?.href).toBe("/api/linkedin/authorize");
  });
});
