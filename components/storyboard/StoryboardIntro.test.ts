import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryboardIntro } from "@/components/storyboard/StoryboardIntro";

function render(props: { canGenerate: boolean; generationEnabled: boolean }) {
  return renderToStaticMarkup(createElement(StoryboardIntro, props));
}

describe("StoryboardIntro rendering", () => {
  it("renders the heading and bulk-generation guidance when allowed", () => {
    const html = render({ canGenerate: true, generationEnabled: true });
    expect(html).toContain("Storyboard");
    expect(html).toContain("Every approved scene appears here");
    expect(html).toContain("generate their images in bulk");
  });

  it("explains view-only access", () => {
    const html = render({ canGenerate: false, generationEnabled: true });
    expect(html).toContain("view-only access");
  });

  it("explains disabled generation", () => {
    const html = render({ canGenerate: false, generationEnabled: false });
    expect(html).toContain("disabled by server configuration");
  });
});
