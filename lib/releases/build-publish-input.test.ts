import { describe, expect, it } from "vitest";
import {
  buildScheduledPublishInput,
  canScheduleReleasePlatform,
  describeUnschedulablePlatform,
  type ScheduledReleaseMetadata,
} from "@/lib/releases/build-publish-input";

const ids = {
  scheduleId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  renderId: "33333333-3333-4333-8333-333333333333",
  connectionId: "44444444-4444-4444-8444-444444444444",
};

const youtube: ScheduledReleaseMetadata = {
  platform: "youtube",
  title: "The 7-Day Reset",
  description: "What actually changed.",
  tags: ["money", "habits"],
  visibility: "public",
  caption: null,
  shareToFeed: null,
};

function build(metadata: ScheduledReleaseMetadata) {
  return buildScheduledPublishInput({ ...ids, metadata });
}

describe("building the request from what was saved", () => {
  it("publishes the stored wording, not anything read later", () => {
    const result = build(youtube);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      platform: "youtube",
      title: "The 7-Day Reset",
      description: "What actually changed.",
      tags: ["money", "habits"],
      visibility: "public",
    });
  });

  it("uses the schedule's own id as the nonce, so a repeat cannot double-publish", () => {
    // Deterministic on purpose: a retried dispatch resolves to the same
    // idempotency key rather than a second upload.
    const first = build(youtube);
    const second = build(youtube);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.input.requestNonce).toBe(ids.scheduleId);
    expect(second.input.requestNonce).toBe(first.input.requestNonce);
  });

  it("carries the exact render and channel that were scheduled", () => {
    const result = build(youtube);
    if (!result.ok) return;
    expect(result.input.renderId).toBe(ids.renderId);
    expect(result.input.connectionId).toBe(ids.connectionId);
  });

  it("builds an Instagram release from its caption", () => {
    const result = build({
      ...youtube,
      platform: "instagram",
      caption: "Three habits that stuck.",
      shareToFeed: true,
      visibility: "public",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      platform: "instagram",
      caption: "Three habits that stuck.",
      shareToFeed: true,
      visibility: "public",
    });
  });

  it("builds a Facebook release", () => {
    const result = build({ ...youtube, platform: "facebook" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.platform).toBe("facebook");
  });
});

describe("refusing to publish something incomplete", () => {
  it("refuses a release with no saved title", () => {
    const result = build({ ...youtube, title: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("no saved title");
  });

  it("refuses an Instagram release with no saved caption", () => {
    const result = build({ ...youtube, platform: "instagram", caption: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("no saved caption");
  });

  it("refuses a visibility the platform never accepted", () => {
    // Silently downgrading would publish at a different visibility than the
    // creator chose, which is worse than not publishing.
    const result = build({
      ...youtube,
      platform: "facebook",
      visibility: "unlisted",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Facebook does not accept");
  });

  it("refuses a visibility that is not a real value at all", () => {
    expect(build({ ...youtube, visibility: "nonsense" }).ok).toBe(false);
  });
});

describe("TikTok is deliberately not schedulable", () => {
  it("is excluded, while the others are allowed", () => {
    expect(canScheduleReleasePlatform("tiktok")).toBe(false);
    for (const platform of ["youtube", "facebook", "instagram"] as const)
      expect(canScheduleReleasePlatform(platform)).toBe(true);
  });

  it("explains why rather than failing silently", () => {
    const reason = describeUnschedulablePlatform("tiktok");
    expect(reason).toContain("inbox");
    expect(reason).toContain("confirmation");
  });

  it("gives no reason for a platform that can be scheduled", () => {
    expect(describeUnschedulablePlatform("youtube")).toBeNull();
  });

  it("refuses to build a TikTok request even if one is asked for", () => {
    const result = build({ ...youtube, platform: "tiktok" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("inbox");
  });
});
