import { createHash } from "node:crypto";

export const DOCUMENT_CHUNK_MAX_CHARACTERS = 12_000;

export type DocumentSourceLocation = {
  kind: "text" | "page" | "section";
  start: number;
  end: number;
  label: string;
};

export type DocumentChunk = {
  index: number;
  text: string;
  checksum: string;
  tokenEstimate: number;
  sourceLocation: DocumentSourceLocation;
};

export function chunkDocumentSections(
  sections: { text: string; sourceLocation: DocumentSourceLocation }[],
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  for (const section of sections) {
    for (let offset = 0; offset < section.text.length;) {
      let end = Math.min(
        offset + DOCUMENT_CHUNK_MAX_CHARACTERS,
        section.text.length,
      );
      if (end < section.text.length) {
        const boundary = section.text.lastIndexOf("\n\n", end);
        if (boundary > offset + DOCUMENT_CHUNK_MAX_CHARACTERS / 2)
          end = boundary;
      }
      const text = section.text.slice(offset, end).trim();
      if (text !== "")
        chunks.push({
          index: chunks.length,
          text,
          checksum: createHash("sha256").update(text).digest("hex"),
          tokenEstimate: Math.ceil(text.length / 4),
          sourceLocation: section.sourceLocation,
        });
      offset = Math.max(end, offset + 1);
    }
  }
  return chunks;
}
