import { createHash } from "node:crypto";
import type { MarketingDocumentContentType } from "@/lib/schemas/marketing-document";

export type ExtractedDocument = {
  text: string;
  characterCount: number;
  tokenEstimate: number;
  checksum: string;
};

/**
 * Strips Markdown syntax down to the prose underneath.
 *
 * The studio grounds on what a document *says*, not how it was formatted, and
 * leaving the syntax in wastes context on pipes and hashes. Deliberately a small
 * set of well-understood rules rather than a parser dependency: fenced code
 * blocks are dropped entirely (they are rarely brand facts and are the densest
 * thing in a typical document), and links collapse to their label.
 */
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}([-*_]\s*){3,}$/gm, " ")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/\|/g, " ");
}

function normalise(text: string): string {
  return (
    text
      .replace(/\r\n?/g, "\n")
      // Collapse runs of blank lines, but keep paragraph breaks: they are the
      // only structural signal that survives, and losing them turns a document
      // into one unreadable block.
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim()
  );
}

/**
 * Reads a stored document into plain text.
 *
 * Pure and synchronous — the caller supplies the bytes. That keeps it testable
 * without touching storage, and means the same function works in a web request
 * and in a worker.
 */
export function extractDocumentText(input: {
  bytes: Uint8Array;
  contentType: MarketingDocumentContentType;
}): ExtractedDocument {
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
  const text = normalise(
    input.contentType === "text/markdown" ? stripMarkdown(raw) : raw,
  );

  return {
    text,
    characterCount: text.length,
    // The same 4-characters-per-token approximation the cost estimators use, so
    // a document's budget contribution is measured consistently.
    tokenEstimate: Math.ceil(text.length / 4),
    checksum: createHash("sha256").update(text).digest("hex"),
  };
}
