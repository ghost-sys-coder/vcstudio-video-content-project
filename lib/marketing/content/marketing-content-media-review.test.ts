import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketingContentMediaReview } from "@/components/marketing/MarketingContentMediaReview";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

function media(kind: "image" | "video"): MediaAssetView {
  return {
    id: `asset-${kind}`,
    kind,
    title: "Campaign media",
    altText: "Campaign preview",
    tags: [],
    contentType: kind === "image" ? "image/png" : "video/mp4",
    sizeBytes: 100,
    width: 1080,
    height: 1350,
    durationMilliseconds: kind === "video" ? 10_000 : null,
    originalFileName: `campaign.${kind === "image" ? "png" : "mp4"}`,
    createdAt: "2026-08-05T00:00:00.000Z",
    previewUrl: `https://assets.example/${kind}`,
  };
}

describe("MarketingContentMediaReview", () => {
  it.each(["image", "video"] as const)(
    "overlays content information on a %s",
    (kind) => {
      const markup = renderToStaticMarkup(
        createElement(MarketingContentMediaReview, {
          assets: [media(kind)],
          body: "A concise supporting caption.",
          expectsGraphic: kind === "image",
          kind: "graphic",
          platform: "instagram",
          status: "needs_review",
          title: "Launch the redesign service",
        }),
      );

      expect(markup).toContain("Launch the redesign service");
      expect(markup).toContain("A concise supporting caption.");
      expect(markup).toContain("instagram");
      expect(markup).toContain("needs review");
      expect(markup).toContain(kind === "image" ? "<img" : "<video");
    },
  );
});
