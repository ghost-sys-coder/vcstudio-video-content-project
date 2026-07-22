import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VideoPublicationRow } from "@/components/publish/VideoPublicationRow";
import type { PublicationView } from "@/lib/publishing/publishing-view";

const publication: PublicationView = {
  id: "publication-id",
  connectionId: "connection-id",
  renderId: "render-id",
  platform: "youtube",
  platformLabel: "YouTube",
  title: "Published title",
  status: "uploading",
  visibility: "public",
  progressPercent: 42,
  externalVideoUrl: null,
  safeErrorMessage: null,
  providerOperationStage: "uploading",
  createdAtLabel: "2026-07-22 23:00 UTC",
};

describe("VideoPublicationRow", () => {
  it("shows visible and accessible progress while publishing", () => {
    const html = renderToStaticMarkup(
      createElement(VideoPublicationRow, {
        busy: false,
        canManage: true,
        onCancel: vi.fn(),
        publication,
      }),
    );

    expect(html).toContain("Uploading · 42%");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain("width:42%");
  });

  it("removes the active progress bar after publication succeeds", () => {
    const html = renderToStaticMarkup(
      createElement(VideoPublicationRow, {
        busy: false,
        canManage: true,
        onCancel: vi.fn(),
        publication: {
          ...publication,
          status: "succeeded",
          progressPercent: 100,
        },
      }),
    );

    expect(html).toContain("Published");
    expect(html).not.toContain('role="progressbar"');
  });
});
