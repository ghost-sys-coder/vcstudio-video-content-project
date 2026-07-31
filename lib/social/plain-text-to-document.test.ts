import { describe, expect, it } from "vitest";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";
import { portableDocumentSchema } from "@/lib/social/portable-document";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";

describe("plainTextToPortableDocument", () => {
  it("produces a document the stored schema accepts", () => {
    const document = plainTextToPortableDocument("Hello\n\nWorld");
    expect(() => portableDocumentSchema.parse(document)).not.toThrow();
  });

  it("starts a new paragraph on a blank line", () => {
    const document = plainTextToPortableDocument("First\n\nSecond");
    expect(document.content).toHaveLength(2);
  });

  it("keeps a single newline as a hard break inside one paragraph", () => {
    const document = plainTextToPortableDocument("First\nSecond");
    expect(document.content).toHaveLength(1);
    expect(document.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "First" },
        { type: "hardBreak" },
        { type: "text", text: "Second" },
      ],
    });
  });

  it("normalises Windows line endings", () => {
    expect(plainTextToPortableDocument("a\r\n\r\nb").content).toHaveLength(2);
  });

  it("returns an empty document for blank input", () => {
    expect(plainTextToPortableDocument("   \n  ").content).toEqual([]);
  });

  it("round-trips through the flattener that decides what gets published", () => {
    const text = "Line one\nLine two\n\nA new thought";
    expect(
      renderPortableDocumentToPlainText(plainTextToPortableDocument(text)),
    ).toBe(text);
  });

  it("collapses runs of more than two blank lines rather than emitting empty paragraphs", () => {
    const document = plainTextToPortableDocument("a\n\n\n\nb");
    expect(document.content).toHaveLength(2);
  });
});
