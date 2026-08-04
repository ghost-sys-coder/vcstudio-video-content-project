import { describe, expect, it } from "vitest";

import { createMarketingOperationIdempotencyKey } from "@/lib/domain/idempotency";

const base = {
  secret: "test-secret",
  workspaceId: "workspace-1",
  operation: "document_summary",
  subjectId: "document-1",
  subjectFingerprint: "checksum-a",
  model: "gpt-test",
  promptVersion: "marketing-document-summary-v1",
};

function key(overrides: Partial<typeof base> = {}) {
  return createMarketingOperationIdempotencyKey({ ...base, ...overrides });
}

describe("createMarketingOperationIdempotencyKey", () => {
  it("is stable for identical input", () => {
    expect(key()).toBe(key());
  });

  it("changes when the subject's content changes", () => {
    // This is what stops an edited document reusing the summary of its old text.
    expect(key({ subjectFingerprint: "checksum-b" })).not.toBe(key());
  });

  it("does not collide across workspaces", () => {
    // Two workspaces summarising an identical document must each pay once and
    // must never read each other's run.
    expect(key({ workspaceId: "workspace-2" })).not.toBe(key());
  });

  it("does not collide across operations on the same subject", () => {
    expect(key({ operation: "content_draft" })).not.toBe(key());
  });

  it("changes when the prompt version changes", () => {
    // A new prompt is genuinely new work; reusing the old run would silently
    // serve output the current template would not produce.
    expect(key({ promptVersion: "marketing-document-summary-v2" })).not.toBe(
      key(),
    );
  });

  it("changes when the model changes", () => {
    expect(key({ model: "gpt-other" })).not.toBe(key());
  });

  it("is not derivable without the secret", () => {
    expect(key({ secret: "other-secret" })).not.toBe(key());
  });

  it("returns a hex digest rather than anything readable", () => {
    expect(key()).toMatch(/^[0-9a-f]{64}$/);
  });
});
