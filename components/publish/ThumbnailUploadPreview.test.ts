import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThumbnailUploadPreview } from "@/components/publish/ThumbnailUploadPreview";
import { describeThumbnailUploadTarget } from "@/lib/thumbnails/thumbnail-upload-fit";

function render(aspectRatio: number, platformLabel = "YouTube") {
  return renderToStaticMarkup(
    createElement(ThumbnailUploadPreview, {
      previewUrl: "blob:local-preview",
      aspectRatio,
      platformLabel,
      onMeasured: () => undefined,
      onUnreadable: () => undefined,
    }),
  );
}

describe("ThumbnailUploadPreview", () => {
  it("draws the frame at the platform's own shape", () => {
    const html = render(
      describeThumbnailUploadTarget("youtube").previewAspectRatio,
    );
    expect(html).toContain("aspect-ratio");
    expect(html).toContain(String(16 / 9));
  });

  it("uses a vertical frame for a vertical platform", () => {
    const html = render(
      describeThumbnailUploadTarget("tiktok").previewAspectRatio,
      "TikTok",
    );
    expect(html).toContain(String(9 / 16));
  });

  it("shows the whole file rather than cropping it to look correct", () => {
    // Contain, not cover: letterboxing is how a wrong shape becomes visible
    // instead of being silently trimmed into looking right.
    const html = render(16 / 9);
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
  });

  it("renders the local file, never a remote URL", () => {
    expect(render(16 / 9)).toContain('src="blob:local-preview"');
  });

  it("describes the preview for assistive technology", () => {
    expect(render(16 / 9)).toContain(
      'alt="Preview of the YouTube thumbnail to upload"',
    );
  });
});
