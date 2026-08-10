import "server-only";

import { createHash } from "node:crypto";
import mammoth from "mammoth";
import type { MarketingDocumentContentType } from "@/lib/schemas/marketing-document";
import {
  chunkDocumentSections,
  type DocumentChunk,
} from "@/lib/marketing/documents/chunk-document";
import {
  extractDocumentText,
  type ExtractedDocument,
} from "@/lib/marketing/documents/extract-text";
import { extractPdfSections } from "@/lib/marketing/documents/extract-pdf";

export type StoredDocumentExtraction = ExtractedDocument & {
  chunks: DocumentChunk[];
};

function finish(
  sections: { text: string; sourceLocation: DocumentChunk["sourceLocation"] }[],
): StoredDocumentExtraction {
  const chunks = chunkDocumentSections(sections);
  const text = sections
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join("\n\n");
  return {
    text,
    characterCount: text.length,
    tokenEstimate: Math.ceil(text.length / 4),
    checksum: createHash("sha256").update(text).digest("hex"),
    chunks,
  };
}

export async function extractStoredDocument(input: {
  bytes: Uint8Array;
  contentType: MarketingDocumentContentType;
}): Promise<StoredDocumentExtraction> {
  if (
    input.contentType === "text/plain" ||
    input.contentType === "text/markdown"
  ) {
    const extracted = extractDocumentText(input);
    return finish([
      {
        text: extracted.text,
        sourceLocation: { kind: "text", start: 1, end: 1, label: "Document" },
      },
    ]);
  }
  if (
    input.contentType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(input.bytes),
    });
    return finish([
      {
        text: result.value,
        sourceLocation: {
          kind: "section",
          start: 1,
          end: 1,
          label: "Word document",
        },
      },
    ]);
  }
  return finish(await extractPdfSections(input.bytes));
}
