import { describe, expect, it } from "vitest";

import { extractDocumentText } from "@/lib/marketing/documents/extract-text";

function extract(text: string, contentType: "text/plain" | "text/markdown") {
  return extractDocumentText({
    bytes: new TextEncoder().encode(text),
    contentType,
  });
}

describe("extractDocumentText", () => {
  it("keeps plain text as written", () => {
    const result = extract("We build video tools.", "text/plain");
    expect(result.text).toBe("We build video tools.");
    expect(result.characterCount).toBe(21);
  });

  it("strips Markdown syntax down to the prose", () => {
    const result = extract(
      "# Heading\n\nSome **bold** and _italic_ text with a [link](https://example.com).",
      "text/markdown",
    );
    expect(result.text).toBe(
      "Heading\n\nSome bold and italic text with a link.",
    );
  });

  it("drops fenced code blocks entirely", () => {
    // They are rarely brand facts and are the densest thing in a typical
    // document — keeping them would spend the context budget on syntax.
    const result = extract(
      "Intro text.\n\n```js\nconst a = 1;\n```\n\nOutro text.",
      "text/markdown",
    );
    expect(result.text).not.toContain("const a");
    expect(result.text).toContain("Intro text.");
    expect(result.text).toContain("Outro text.");
  });

  it("keeps paragraph breaks but collapses longer runs", () => {
    const result = extract("One.\n\n\n\n\nTwo.", "text/plain");
    expect(result.text).toBe("One.\n\nTwo.");
  });

  it("normalises Windows line endings", () => {
    expect(extract("One.\r\nTwo.", "text/plain").text).toBe("One.\nTwo.");
  });

  it("reports an empty document as zero characters rather than throwing", () => {
    const result = extract("   \n\n  ", "text/plain");
    expect(result.characterCount).toBe(0);
    expect(result.text).toBe("");
  });

  it("estimates tokens on the same 4-characters-per-token basis as the cost helpers", () => {
    const result = extract("x".repeat(400), "text/plain");
    expect(result.tokenEstimate).toBe(100);
  });

  it("produces a stable checksum for identical text", () => {
    // This is what makes summarisation idempotent: unchanged text must skip the
    // model call entirely.
    expect(extract("Same text.", "text/plain").checksum).toBe(
      extract("Same text.", "text/plain").checksum,
    );
  });

  it("produces a different checksum for different text", () => {
    expect(extract("One.", "text/plain").checksum).not.toBe(
      extract("Two.", "text/plain").checksum,
    );
  });

  it("gives Markdown and plain text the same checksum once syntax is stripped", () => {
    // The studio grounds on what a document says, not how it was formatted.
    expect(extract("**Hello**", "text/markdown").checksum).toBe(
      extract("Hello", "text/plain").checksum,
    );
  });
});
