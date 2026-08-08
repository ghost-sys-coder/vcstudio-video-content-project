import { describe, expect, it } from "vitest";
import {
  publishSocialPostSchema,
  scheduleSocialPostSchema,
} from "@/lib/schemas/social-post";

const postId = "11111111-1111-4111-8111-111111111111";
const connectionId = "22222222-2222-4222-8222-222222222222";

describe("social post platform captions", () => {
  it("accepts distinct per-platform captions for immediate publishing", () => {
    const result = publishSocialPostSchema.safeParse({
      postId,
      connectionIds: [connectionId],
      requestNonce: "request-123",
      captionOverrides: [
        { platform: "linkedin", text: "Professional launch copy" },
        { platform: "instagram", text: "Visual launch copy #launch" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate platform captions", () => {
    const result = publishSocialPostSchema.safeParse({
      postId,
      connectionIds: [connectionId],
      requestNonce: "request-123",
      captionOverrides: [
        { platform: "linkedin", text: "First" },
        { platform: "linkedin", text: "Second" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("applies platform character limits to scheduled captions", () => {
    const result = scheduleSocialPostSchema.safeParse({
      postId,
      scheduledAt: "2026-08-20T12:00:00.000Z",
      timezone: "Africa/Kampala",
      connectionIds: [connectionId],
      requestNonce: "request-123",
      captionOverrides: [{ platform: "x", text: "x".repeat(281) }],
    });
    expect(result.success).toBe(false);
  });
});
