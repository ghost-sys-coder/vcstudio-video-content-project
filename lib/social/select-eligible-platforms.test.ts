import { describe, expect, it } from "vitest";
import {
  PLATFORM_POST_CAPABILITIES,
  SOCIAL_POST_PLATFORMS,
} from "@/lib/social/platform-post-capabilities";
import {
  checkPlatformEligibility,
  selectEligiblePlatforms,
  summarizeAttachments,
} from "@/lib/social/select-eligible-platforms";

function eligible(input: {
  platform: (typeof SOCIAL_POST_PLATFORMS)[number];
  imageCount?: number;
  videoCount?: number;
  plainTextLength?: number;
}) {
  return checkPlatformEligibility({
    platform: input.platform,
    attachments: {
      imageCount: input.imageCount ?? 0,
      videoCount: input.videoCount ?? 0,
    },
    plainTextLength: input.plainTextLength ?? 20,
  });
}

describe("summarizeAttachments", () => {
  it("counts each kind", () => {
    expect(summarizeAttachments(["image", "video", "image"])).toEqual({
      imageCount: 2,
      videoCount: 1,
    });
  });
});

describe("checkPlatformEligibility", () => {
  it("allows text on its own only where the platform accepts it", () => {
    expect(eligible({ platform: "linkedin" }).eligible).toBe(true);
    expect(eligible({ platform: "twitter" }).eligible).toBe(true);
    expect(eligible({ platform: "facebook" }).eligible).toBe(true);

    for (const platform of ["instagram", "tiktok", "youtube"] as const) {
      const result = eligible({ platform });
      expect(result.eligible).toBe(false);
      if (!result.eligible)
        expect(result.reason).toBe(
          PLATFORM_POST_CAPABILITIES[platform].mediaRequirement,
        );
    }
  });

  it("drops X, and only X, when a post runs past 280 characters", () => {
    const body = { plainTextLength: 500 };
    expect(eligible({ platform: "linkedin", ...body }).eligible).toBe(true);
    expect(eligible({ platform: "facebook", ...body }).eligible).toBe(true);

    // X's ceiling is an order of magnitude below every other text destination,
    // so it is routinely the one platform a perfectly valid post cannot go to.
    const result = eligible({ platform: "twitter", ...body });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain("280");
  });

  it("caps X at four images", () => {
    expect(eligible({ platform: "twitter", imageCount: 4 }).eligible).toBe(
      true,
    );
    const tooMany = eligible({ platform: "twitter", imageCount: 5 });
    expect(tooMany.eligible).toBe(false);
    if (!tooMany.eligible) expect(tooMany.reason).toContain("4 images");
  });

  it("explains that YouTube has no community-post API rather than just failing", () => {
    const result = eligible({ platform: "youtube" });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain("no public API");
  });

  it("unlocks every platform once a video is attached", () => {
    for (const platform of SOCIAL_POST_PLATFORMS)
      expect(eligible({ platform, videoCount: 1 }).eligible).toBe(true);
  });

  it("unlocks only the image-capable platforms when images are attached", () => {
    expect(eligible({ platform: "linkedin", imageCount: 3 }).eligible).toBe(
      true,
    );
    expect(eligible({ platform: "facebook", imageCount: 3 }).eligible).toBe(
      true,
    );
    expect(eligible({ platform: "instagram", imageCount: 3 }).eligible).toBe(
      true,
    );
    expect(eligible({ platform: "tiktok", imageCount: 3 }).eligible).toBe(
      false,
    );
    expect(eligible({ platform: "youtube", imageCount: 3 }).eligible).toBe(
      false,
    );
  });

  it("applies each platform's own image ceiling", () => {
    expect(eligible({ platform: "linkedin", imageCount: 20 }).eligible).toBe(
      true,
    );
    const tooMany = eligible({ platform: "linkedin", imageCount: 21 });
    expect(tooMany.eligible).toBe(false);
    if (!tooMany.eligible) expect(tooMany.reason).toContain("20 images");

    const instagram = eligible({ platform: "instagram", imageCount: 11 });
    expect(instagram.eligible).toBe(false);
    if (!instagram.eligible) expect(instagram.reason).toContain("10 images");
  });

  it("refuses to mix images and a video in one post", () => {
    const result = eligible({
      platform: "linkedin",
      imageCount: 1,
      videoCount: 1,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain("not both");
  });

  it("refuses more than one video", () => {
    const result = eligible({ platform: "facebook", videoCount: 2 });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain("Only one video");
  });

  it("applies each platform's character ceiling to the flattened text", () => {
    expect(
      eligible({ platform: "linkedin", plainTextLength: 3000 }).eligible,
    ).toBe(true);
    const overLinkedIn = eligible({
      platform: "linkedin",
      plainTextLength: 3001,
    });
    expect(overLinkedIn.eligible).toBe(false);
    if (!overLinkedIn.eligible) expect(overLinkedIn.reason).toContain("3,000");

    // The same body is well within Facebook's much larger ceiling.
    expect(
      eligible({ platform: "facebook", plainTextLength: 3001 }).eligible,
    ).toBe(true);
  });

  it("asks for content before anything else when the draft is empty", () => {
    const result = eligible({ platform: "linkedin", plainTextLength: 0 });
    expect(result.eligible).toBe(false);
    if (!result.eligible)
      expect(result.reason).toBe("Write something or attach media first.");
  });

  it("allows a media-only post with no body text", () => {
    expect(
      eligible({ platform: "instagram", imageCount: 1, plainTextLength: 0 })
        .eligible,
    ).toBe(true);
  });
});

describe("selectEligiblePlatforms", () => {
  it("reports every platform in a stable order", () => {
    const results = selectEligiblePlatforms({
      attachments: { imageCount: 0, videoCount: 0 },
      plainTextLength: 10,
    });
    expect(results.map((result) => result.platform)).toEqual([
      ...SOCIAL_POST_PLATFORMS,
    ]);
  });

  it("gives a reason for every platform it excludes", () => {
    for (const result of selectEligiblePlatforms({
      attachments: { imageCount: 0, videoCount: 0 },
      plainTextLength: 10,
    }))
      if (!result.eligible) expect(result.reason.length).toBeGreaterThan(0);
  });
});
