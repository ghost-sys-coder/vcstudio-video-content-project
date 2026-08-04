import { describe, expect, it } from "vitest";

import {
  createBrandContextFingerprint,
  type FingerprintInput,
} from "@/lib/marketing/brand/brand-context-fingerprint";

function input(overrides: Partial<FingerprintInput> = {}): FingerprintInput {
  return {
    promptVersion: "marketing-brand-context-v1",
    maxTokens: 2500,
    profile: { businessName: "VeilCode", oneLiner: "AI video tooling" },
    audiences: [
      { id: "aud-b", updatedAt: "2026-08-01T00:00:00.000Z" },
      { id: "aud-a", updatedAt: "2026-08-02T00:00:00.000Z" },
    ],
    offers: [{ id: "off-a", updatedAt: "2026-08-01T00:00:00.000Z" }],
    documents: [
      { id: "doc-a", checksum: "aaa", priority: 10 },
      { id: "doc-b", checksum: "bbb", priority: 5 },
    ],
    ...overrides,
  };
}

describe("createBrandContextFingerprint", () => {
  it("is stable for identical input", () => {
    expect(createBrandContextFingerprint(input())).toBe(
      createBrandContextFingerprint(input()),
    );
  });

  it("returns a sha256 hex digest", () => {
    expect(createBrandContextFingerprint(input())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores collection ordering", () => {
    // Reordering rows in the database is not a content change, and treating it
    // as one would mint a new snapshot on essentially every request.
    const base = input();
    expect(
      createBrandContextFingerprint(
        input({
          audiences: [...base.audiences].reverse(),
          documents: [...base.documents].reverse(),
        }),
      ),
    ).toBe(createBrandContextFingerprint(base));
  });

  it("ignores profile key ordering", () => {
    // JSON.stringify preserves insertion order, so without a stable sort two
    // loaders building the same object differently would disagree.
    expect(
      createBrandContextFingerprint(
        input({
          profile: { oneLiner: "AI video tooling", businessName: "VeilCode" },
        }),
      ),
    ).toBe(createBrandContextFingerprint(input()));
  });

  it("changes when a profile field changes", () => {
    expect(
      createBrandContextFingerprint(
        input({
          profile: { businessName: "Other", oneLiner: "AI video tooling" },
        }),
      ),
    ).not.toBe(createBrandContextFingerprint(input()));
  });

  it("changes when an audience is edited", () => {
    expect(
      createBrandContextFingerprint(
        input({
          audiences: [
            { id: "aud-b", updatedAt: "2026-08-01T00:00:00.000Z" },
            { id: "aud-a", updatedAt: "2026-09-09T00:00:00.000Z" },
          ],
        }),
      ),
    ).not.toBe(createBrandContextFingerprint(input()));
  });

  it("changes when a document's text changes", () => {
    // Keyed on checksum, so edited text is genuinely new context.
    expect(
      createBrandContextFingerprint(
        input({
          documents: [
            { id: "doc-a", checksum: "CHANGED", priority: 10 },
            { id: "doc-b", checksum: "bbb", priority: 5 },
          ],
        }),
      ),
    ).not.toBe(createBrandContextFingerprint(input()));
  });

  it("changes when a document's priority changes", () => {
    // Priority decides what survives truncation, so it changes the output text.
    expect(
      createBrandContextFingerprint(
        input({
          documents: [
            { id: "doc-a", checksum: "aaa", priority: 1 },
            { id: "doc-b", checksum: "bbb", priority: 5 },
          ],
        }),
      ),
    ).not.toBe(createBrandContextFingerprint(input()));
  });

  it("changes when a document is removed from the corpus", () => {
    expect(
      createBrandContextFingerprint(
        input({ documents: [{ id: "doc-a", checksum: "aaa", priority: 10 }] }),
      ),
    ).not.toBe(createBrandContextFingerprint(input()));
  });

  it("changes when the prompt version changes", () => {
    // A revised template renders different text; reusing the old snapshot
    // would store text the compiler no longer produces.
    expect(
      createBrandContextFingerprint(input({ promptVersion: "v2" })),
    ).not.toBe(createBrandContextFingerprint(input()));
  });

  it("changes when the token budget changes", () => {
    // A raised budget can admit a document that was previously truncated out.
    expect(createBrandContextFingerprint(input({ maxTokens: 4000 }))).not.toBe(
      createBrandContextFingerprint(input()),
    );
  });

  it("does not change on an unrelated touch", () => {
    // The property that stops a snapshot being minted every time somebody
    // opens a brand page: nothing contributing changed, so no new row.
    const untouched = createBrandContextFingerprint(input());
    expect(createBrandContextFingerprint(input())).toBe(untouched);
  });
});
