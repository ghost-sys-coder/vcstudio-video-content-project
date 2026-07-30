import { describe, expect, it } from "vitest";
import { portableDocumentSchema } from "@/lib/social/portable-document";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";

function render(content: unknown[]): string {
  return renderPortableDocumentToPlainText(
    portableDocumentSchema.parse({ type: "doc", content }),
  );
}

describe("renderPortableDocumentToPlainText", () => {
  it("drops bold and italic rather than faking them with Unicode look-alikes", () => {
    const output = render([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Ship ", marks: [{ type: "bold" }] },
          { type: "text", text: "it", marks: [{ type: "italic" }] },
        ],
      },
    ]);
    expect(output).toBe("Ship it");
    // Unicode math-alphanumeric bold would defeat screen readers and platform
    // search, so nothing outside the basic plane should appear.
    expect(/[\u{1D400}-\u{1D7FF}]/u.test(output)).toBe(false);
  });

  it("renders a link as its bare URL when the label is the URL", () => {
    expect(
      render([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "https://example.com",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ]),
    ).toBe("https://example.com");
  });

  it("keeps the destination when a link has its own label", () => {
    expect(
      render([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "our launch post",
              marks: [
                { type: "link", attrs: { href: "https://example.com/x" } },
              ],
            },
          ],
        },
      ]),
    ).toBe("our launch post (https://example.com/x)");
  });

  it("turns bullet and ordered lists into typed-by-hand lines", () => {
    expect(
      render([
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "one" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "two" }] },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "first" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "second" }],
                },
              ],
            },
          ],
        },
      ]),
    ).toBe("• one\n• two\n\n1. first\n2. second");
  });

  it("separates blocks with a blank line and a hard break with one newline", () => {
    expect(
      render([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a" },
            { type: "hardBreak" },
            { type: "text", text: "b" },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "c" }] },
      ]),
    ).toBe("a\nb\n\nc");
  });

  it("collapses the runs of blank lines that empty paragraphs leave behind", () => {
    expect(
      render([
        { type: "paragraph", content: [{ type: "text", text: "top" }] },
        { type: "paragraph" },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "bottom" }] },
      ]),
    ).toBe("top\n\nbottom");
  });

  it("returns an empty string for an empty document", () => {
    expect(render([])).toBe("");
    expect(render([{ type: "paragraph" }])).toBe("");
  });
});
