import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CopyButton } from "@/components/ui/CopyButton";

function render(value: string, label = "the title") {
  return renderToStaticMarkup(createElement(CopyButton, { value, label }));
}

describe("CopyButton", () => {
  it("names what it copies, so several on a page stay distinguishable", () => {
    expect(render("A title")).toContain('aria-label="Copy the title"');
  });

  it("is disabled when there is nothing to copy", () => {
    // Writing an empty string to the clipboard destroys whatever the creator
    // had copied before, so an empty field must not offer the action. The
    // attribute is matched, not the substring: the class list carries
    // "disabled:" variants that are present either way.
    expect(render("")).toContain('disabled=""');
    expect(render("   ")).toContain('disabled=""');
  });

  it("is enabled once the field has content", () => {
    expect(render("A title")).not.toContain('disabled=""');
  });

  it("explains why it is unavailable rather than just greying out", () => {
    expect(render("")).toContain('title="Nothing to copy yet"');
  });

  it("is a button, so it never submits a form it sits inside", () => {
    expect(render("A title")).toContain('type="button"');
  });
});
