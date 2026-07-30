import { describe, expect, it } from "vitest";
import {
  countPortableDocumentCharacters,
  isPortableDocumentEmpty,
  portableDocumentSchema,
} from "@/lib/social/portable-document";

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

describe("portableDocumentSchema", () => {
  it("accepts the block and mark set the composer can produce", () => {
    const parsed = portableDocumentSchema.parse({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bold", marks: [{ type: "bold" }] },
            { type: "hardBreak" },
            {
              type: "text",
              text: "a link",
              marks: [
                { type: "link", attrs: { href: "https://example.com/post" } },
              ],
            },
          ],
        },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph("one")] }],
        },
        {
          type: "orderedList",
          content: [{ type: "listItem", content: [paragraph("first")] }],
        },
      ],
    });
    expect(parsed.content).toHaveLength(3);
  });

  it("defaults an absent body to an empty document", () => {
    expect(portableDocumentSchema.parse({ type: "doc" })).toEqual({
      type: "doc",
      content: [],
    });
  });

  it("rejects node types the flattener cannot honestly represent", () => {
    for (const node of [
      { type: "heading", attrs: { level: 1 } },
      { type: "image", attrs: { src: "https://example.com/a.png" } },
      { type: "table" },
      { type: "codeBlock" },
    ])
      expect(
        portableDocumentSchema.safeParse({ type: "doc", content: [node] })
          .success,
      ).toBe(false);
  });

  it("rejects a mark type outside the allow-list", () => {
    expect(
      portableDocumentSchema.safeParse({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "strike" }] }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a link scheme that could execute when previewed", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ])
      expect(
        portableDocumentSchema.safeParse({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [{ type: "link", attrs: { href } }],
                },
              ],
            },
          ],
        }).success,
      ).toBe(false);
  });

  it("caps the number of blocks", () => {
    expect(
      portableDocumentSchema.safeParse({
        type: "doc",
        content: Array.from({ length: 2001 }, () => paragraph("x")),
      }).success,
    ).toBe(false);
  });
});

describe("countPortableDocumentCharacters", () => {
  it("counts text across paragraphs and list items, and a break as one", () => {
    const document = portableDocumentSchema.parse({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "abc" },
            { type: "hardBreak" },
            { type: "text", text: "de" },
          ],
        },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph("fg")] }],
        },
      ],
    });
    expect(countPortableDocumentCharacters(document)).toBe(8);
  });

  it("treats a document of empty paragraphs as empty", () => {
    const document = portableDocumentSchema.parse({
      type: "doc",
      content: [{ type: "paragraph" }, { type: "paragraph", content: [] }],
    });
    expect(isPortableDocumentEmpty(document)).toBe(true);
  });
});
