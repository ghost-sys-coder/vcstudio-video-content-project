import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  sanitizeAuditMetadata,
} from "@/lib/audit/audit-actions";
import { auditActionEnum } from "@/db/schema";

describe("sanitizeAuditMetadata", () => {
  it("keeps safe primitive values", () => {
    expect(
      sanitizeAuditMetadata({
        estimatedCostCents: 60,
        preset: "landscape_1080p",
        includeCaptions: true,
        note: null,
      }),
    ).toEqual({
      estimatedCostCents: 60,
      preset: "landscape_1080p",
      includeCaptions: true,
      note: null,
    });
  });

  it("drops sensitive keys", () => {
    expect(
      sanitizeAuditMetadata({
        apiKey: "sk-123",
        authorization: "Bearer abc",
        password: "hunter2",
        keep: "ok",
      }),
    ).toEqual({ keep: "ok" });
  });

  it("drops URL-looking values (e.g. signed R2 URLs)", () => {
    expect(
      sanitizeAuditMetadata({
        download: "https://bucket.r2.cloudflarestorage.com/x?sig=abc",
        name: "clip",
      }),
    ).toEqual({ name: "clip" });
  });

  it("drops non-primitive and non-finite values", () => {
    expect(
      sanitizeAuditMetadata({
        nested: { a: 1 },
        list: [1, 2],
        bad: Number.NaN,
        good: 3,
      }),
    ).toEqual({ good: 3 });
  });

  it("truncates very long strings", () => {
    const long = "a".repeat(600);
    const result = sanitizeAuditMetadata({ long });
    expect(typeof result.long).toBe("string");
    expect((result.long as string).length).toBe(500);
  });
});

describe("AUDIT_ACTION_LABELS", () => {
  it("labels every audit action", () => {
    // Sourced from the enum so adding an action fails here until it is labelled,
    // rather than drifting silently or needing a hand-updated count.
    expect(Object.keys(AUDIT_ACTION_LABELS).sort()).toEqual(
      [...auditActionEnum.enumValues].sort(),
    );
  });

  it("labels the publishing actions", () => {
    expect(AUDIT_ACTION_LABELS.platform_connected).toBe(
      "Platform account connected",
    );
    expect(AUDIT_ACTION_LABELS.video_published).toBe(
      "Video published to platform",
    );
  });
});
