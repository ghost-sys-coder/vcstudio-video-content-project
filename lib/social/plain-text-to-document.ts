import {
  EMPTY_PORTABLE_DOCUMENT,
  type PortableDocument,
  type PortableInlineNode,
} from "@/lib/social/portable-document";

/**
 * Turns typed plain text into a portable document.
 *
 * The seam between a plain textarea — the publish page's quick share box — and
 * the composer's structured body. A blank line starts a new paragraph; a single
 * newline becomes a hard break, which is how people actually write posts and how
 * the flattener renders them back.
 *
 * Deliberately does not attempt to detect emphasis, lists, or links from
 * punctuation: guessing structure from prose produces documents the author never
 * intended, and the composer is where structure is added on purpose.
 */
export function plainTextToPortableDocument(text: string): PortableDocument {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (normalized === "") return EMPTY_PORTABLE_DOCUMENT;

  return {
    type: "doc",
    content: normalized.split(/\n{2,}/).map((block) => {
      const content: PortableInlineNode[] = [];
      block.split("\n").forEach((line, index) => {
        if (index > 0) content.push({ type: "hardBreak" });
        if (line !== "") content.push({ type: "text", text: line });
      });
      return { type: "paragraph" as const, content };
    }),
  };
}
