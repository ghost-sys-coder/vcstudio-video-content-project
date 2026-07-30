import type {
  PortableDocument,
  PortableInlineNode,
  PortableParagraphNode,
} from "@/lib/social/portable-document";

/**
 * Flattens a post document into the plain text a platform actually receives.
 *
 * **This is the single function that decides what gets published.** Every
 * platform in scope — LinkedIn, Facebook, Instagram, TikTok, YouTube — accepts
 * plain text only, so the editor's formatting has to be resolved to something
 * honest here rather than hopefully passed through:
 *
 * - Bold and italic marks are **dropped**. They are not encoded as Unicode
 *   look-alike characters: those defeat screen readers, which read them out
 *   character by character, and platform search does not index them.
 * - A link becomes its bare URL when the text is just the URL again, and
 *   `text (url)` otherwise, because a platform will not render an anchor and a
 *   naked label would lose the destination entirely.
 * - List items become `• ` or `1. ` lines, which is what people type by hand.
 * - Blocks are separated by a blank line; a hard break is a single newline.
 *
 * The composer previews this exact output per platform, so nothing above is a
 * surprise discovered after publishing.
 */

function renderInline(nodes: PortableInlineNode[] | undefined): string {
  let output = "";
  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      output += "\n";
      continue;
    }
    const link = node.marks?.find((mark) => mark.type === "link");
    if (!link) {
      output += node.text;
      continue;
    }
    const href = link.attrs.href;
    const label = node.text.trim();
    output += label === "" || label === href ? href : `${label} (${href})`;
  }
  return output;
}

function renderParagraph(node: PortableParagraphNode): string {
  return renderInline(node.content);
}

export function renderPortableDocumentToPlainText(
  document: PortableDocument,
): string {
  const blocks: string[] = [];

  for (const block of document.content) {
    if (block.type === "paragraph") {
      blocks.push(renderParagraph(block));
      continue;
    }
    const ordered = block.type === "orderedList";
    const lines = (block.content ?? []).map((item, index) => {
      const body = (item.content ?? [])
        .map(renderParagraph)
        .filter((line) => line !== "")
        .join("\n");
      return `${ordered ? `${index + 1}. ` : "• "}${body}`;
    });
    if (lines.length > 0) blocks.push(lines.join("\n"));
  }

  return (
    blocks
      .join("\n\n")
      // Collapse the runs of blank lines an empty paragraph leaves behind —
      // people use them for spacing while drafting, and three or more blank
      // lines look like a mistake once published.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
