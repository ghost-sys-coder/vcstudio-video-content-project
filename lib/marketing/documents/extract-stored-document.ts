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
  const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdf.getDocument({
    data: input.bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const document = await loadingTask.promise;
  const sections: {
    text: string;
    sourceLocation: DocumentChunk["sourceLocation"];
  }[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text)
        sections.push({
          text,
          sourceLocation: {
            kind: "page",
            start: pageNumber,
            end: pageNumber,
            label: `Page ${pageNumber}`,
          },
        });
    }
  } finally {
    await document.destroy();
  }
  return finish(sections);
}
