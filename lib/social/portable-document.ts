import { z } from "zod";

/**
 * The stored shape of a post body.
 *
 * This is a **deliberately narrow subset** of the editor's document model, not a
 * pass-through of whatever the editor produces. Two reasons:
 *
 * 1. It is persisted user input arriving from a browser, so it has to be
 *    validated like any other external input — an unbounded JSON blob in a
 *    `jsonb` column is an injection surface for whatever renders it later.
 * 2. Social platforms accept **plain text**. Nothing here can express something
 *    the flattener cannot honestly represent, so there are no headings, images,
 *    tables, colours, or arbitrary attributes — only the structure that survives
 *    the trip: paragraphs, line breaks, lists, links, and emphasis.
 *
 * Emphasis is kept even though every platform drops it, because it is still
 * meaningful while drafting and the composer shows exactly what will be lost.
 */

export const MAX_POST_DOCUMENT_CHARACTERS = 20_000;
export const MAX_POST_DOCUMENT_NODES = 2_000;

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      // http(s) only: a `javascript:` or `data:` href must never round-trip
      // through storage into a rendered preview.
      href: z
        .url()
        .refine(
          (value) =>
            value.startsWith("http://") || value.startsWith("https://"),
          "Links must start with http:// or https://",
        ),
    }),
  }),
]);

const textNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  marks: z.array(markSchema).max(3).optional(),
});

const hardBreakNodeSchema = z.object({ type: z.literal("hardBreak") });

const inlineNodeSchema = z.union([textNodeSchema, hardBreakNodeSchema]);

const paragraphNodeSchema = z.object({
  type: z.literal("paragraph"),
  content: z.array(inlineNodeSchema).optional(),
});

const listItemNodeSchema = z.object({
  type: z.literal("listItem"),
  content: z.array(paragraphNodeSchema).optional(),
});

const bulletListNodeSchema = z.object({
  type: z.literal("bulletList"),
  content: z.array(listItemNodeSchema).optional(),
});

const orderedListNodeSchema = z.object({
  type: z.literal("orderedList"),
  content: z.array(listItemNodeSchema).optional(),
});

const blockNodeSchema = z.union([
  paragraphNodeSchema,
  bulletListNodeSchema,
  orderedListNodeSchema,
]);

export const portableDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(blockNodeSchema).max(MAX_POST_DOCUMENT_NODES).default([]),
});

export type PortableMark = z.infer<typeof markSchema>;
export type PortableTextNode = z.infer<typeof textNodeSchema>;
export type PortableInlineNode = z.infer<typeof inlineNodeSchema>;
export type PortableParagraphNode = z.infer<typeof paragraphNodeSchema>;
export type PortableListItemNode = z.infer<typeof listItemNodeSchema>;
export type PortableBlockNode = z.infer<typeof blockNodeSchema>;
export type PortableDocument = z.infer<typeof portableDocumentSchema>;

export const EMPTY_PORTABLE_DOCUMENT: PortableDocument = {
  type: "doc",
  content: [],
};

/** Total visible characters, used for the per-platform length counters. */
export function countPortableDocumentCharacters(
  document: PortableDocument,
): number {
  let total = 0;
  const visitInline = (nodes: PortableInlineNode[] | undefined) => {
    for (const node of nodes ?? [])
      total += node.type === "text" ? node.text.length : 1;
  };
  for (const block of document.content) {
    if (block.type === "paragraph") visitInline(block.content);
    else
      for (const item of block.content ?? [])
        for (const paragraph of item.content ?? [])
          visitInline(paragraph.content);
  }
  return total;
}

export function isPortableDocumentEmpty(document: PortableDocument): boolean {
  return countPortableDocumentCharacters(document) === 0;
}
