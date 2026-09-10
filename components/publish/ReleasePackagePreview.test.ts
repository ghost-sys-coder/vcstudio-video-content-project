import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReleasePackagePreview } from "@/components/publish/ReleasePackagePreview";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const THUMBNAIL = "22222222-2222-4222-8222-222222222222";

function render(
  overrides: Partial<Parameters<typeof ReleasePackagePreview>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(ReleasePackagePreview, {
      projectId: PROJECT,
      platform: "youtube",
      title: "The 7-Day Reset",
      destinationLabel: "YouTube · Money Made Clear",
      thumbnailGenerationId: THUMBNAIL,
      thumbnailAvailable: true,
      ...overrides,
    }),
  );
}

describe("ReleasePackagePreview", () => {
  it("shows the title and thumbnail together", () => {
    // Reviewing them apart hides the failure that matters, which is how the
    // pair reads at the size a listing renders.
    const html = render();
    expect(html).toContain("The 7-Day Reset");
    expect(html).toContain(
      `/api/projects/${PROJECT}/thumbnails/${THUMBNAIL}/asset`,
    );
  });

  it("names the destination so the channel can be confirmed", () => {
    expect(render()).toContain("YouTube · Money Made Clear");
  });

  it("clamps the title the way a listing clamps it", () => {
    // A title that would truncate in a feed must truncate here too.
    expect(render()).toContain("line-clamp-2");
  });

  it("stays small rather than filling the page", () => {
    expect(render()).toContain("max-w-[15.5rem]");
  });

  it("frames a vertical platform vertically", () => {
    expect(render({ platform: "tiktok" })).toContain(String(9 / 16));
  });

  it("says no thumbnail is chosen rather than showing an empty box", () => {
    const html = render({ thumbnailGenerationId: null });
    expect(html).toContain("No thumbnail chosen");
    expect(html).not.toContain("/thumbnails/");
  });

  it("distinguishes a deleted thumbnail from one never chosen", () => {
    // These need different fixes, so they must not read the same.
    const html = render({ thumbnailAvailable: false });
    expect(html).toContain("Thumbnail gone");
    expect(html).not.toContain("No thumbnail chosen");
  });

  it("says no title is chosen rather than rendering an empty line", () => {
    expect(render({ title: "   " })).toContain("No title chosen");
  });
});
