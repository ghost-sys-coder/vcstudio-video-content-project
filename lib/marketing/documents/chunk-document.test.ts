import { describe, expect, it } from "vitest";
import {
  chunkDocumentSections,
  DOCUMENT_CHUNK_MAX_CHARACTERS,
} from "@/lib/marketing/documents/chunk-document";

describe("chunkDocumentSections", () => {
  it("bounds chunks and preserves source locations deterministically", () => {
    const input = [
      {
        text: `${"a".repeat(7_000)}\n\n${"b".repeat(7_000)}`,
        sourceLocation: {
          kind: "page" as const,
          start: 4,
          end: 4,
          label: "Page 4",
        },
      },
    ];
    const first = chunkDocumentSections(input);
    const second = chunkDocumentSections(input);
    expect(first.length).toBe(2);
    expect(
      first.every(
        (chunk) => chunk.text.length <= DOCUMENT_CHUNK_MAX_CHARACTERS,
      ),
    ).toBe(true);
    expect(first.map((chunk) => chunk.checksum)).toEqual(
      second.map((chunk) => chunk.checksum),
    );
    expect(first[0]?.sourceLocation.label).toBe("Page 4");
  });

  it("does not create empty chunks", () => {
    expect(
      chunkDocumentSections([
        {
          text: "  ",
          sourceLocation: { kind: "text", start: 1, end: 1, label: "Document" },
        },
      ]),
    ).toEqual([]);
  });
});
