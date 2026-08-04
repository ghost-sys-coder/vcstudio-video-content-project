import { describe, expect, it } from "vitest";

import {
  MARKETING_DOCUMENT_EXTENSIONS,
  MAX_PASTED_DOCUMENT_CHARACTERS,
  pasteDocumentSchema,
  readUpdateDocumentForm,
  requestDocumentUploadSchema,
  updateDocumentSchema,
} from "@/lib/schemas/marketing-document";
import {
  createMarketingDocumentObjectKey,
  isMarketingDocumentObjectKey,
} from "@/lib/storage/object-key";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";

describe("marketing document schemas", () => {
  it("accepts only the formats that parse without a dependency", () => {
    expect(Object.keys(MARKETING_DOCUMENT_EXTENSIONS)).toEqual([
      "text/plain",
      "text/markdown",
    ]);
    expect(
      requestDocumentUploadSchema.safeParse({
        title: "Brand deck",
        fileName: "deck.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      }).success,
    ).toBe(false);
  });

  it("rejects a zero-byte upload", () => {
    expect(
      requestDocumentUploadSchema.safeParse({
        title: "Empty",
        fileName: "a.txt",
        contentType: "text/plain",
        sizeBytes: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects pasted text past the ceiling", () => {
    expect(
      pasteDocumentSchema.safeParse({
        title: "Huge",
        body: "x".repeat(MAX_PASTED_DOCUMENT_CHARACTERS + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects pasted text that is only whitespace", () => {
    expect(
      pasteDocumentSchema.safeParse({ title: "Blank", body: "   \n  " })
        .success,
    ).toBe(false);
  });

  it("reads an unticked include checkbox as false", () => {
    const data = new FormData();
    data.set("documentId", DOCUMENT);
    data.set("title", "Notes");
    data.set("priority", "3");
    const parsed = updateDocumentSchema.safeParse(readUpdateDocumentForm(data));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.includeInContext).toBe(false);
  });
});

describe("marketing document object keys", () => {
  it("derives the key from ids only, never the file name", () => {
    const key = createMarketingDocumentObjectKey({
      workspaceId: WORKSPACE,
      documentId: DOCUMENT,
      contentType: "text/markdown",
    });
    expect(key).toBe(
      `workspaces/${WORKSPACE}/marketing/documents/${DOCUMENT}.md`,
    );
  });

  it("lives outside the project and library prefixes", () => {
    // Brand knowledge outlives any project, and it is not library media a post
    // could attach.
    const key = createMarketingDocumentObjectKey({
      workspaceId: WORKSPACE,
      documentId: DOCUMENT,
      contentType: "text/plain",
    });
    expect(key).not.toContain("/projects/");
    expect(key).not.toContain("/library/");
  });

  it("refuses a key belonging to another workspace or document", () => {
    const key = createMarketingDocumentObjectKey({
      workspaceId: WORKSPACE,
      documentId: DOCUMENT,
      contentType: "text/plain",
    });
    expect(
      isMarketingDocumentObjectKey({
        workspaceId: WORKSPACE,
        documentId: DOCUMENT,
        contentType: "text/plain",
        objectKey: key,
      }),
    ).toBe(true);
    expect(
      isMarketingDocumentObjectKey({
        workspaceId: "33333333-3333-4333-8333-333333333333",
        documentId: DOCUMENT,
        contentType: "text/plain",
        objectKey: key,
      }),
    ).toBe(false);
  });

  it("refuses a traversal attempt", () => {
    expect(
      isMarketingDocumentObjectKey({
        workspaceId: WORKSPACE,
        documentId: DOCUMENT,
        contentType: "text/plain",
        objectKey: `workspaces/${WORKSPACE}/marketing/documents/../../secret.txt`,
      }),
    ).toBe(false);
  });
});
