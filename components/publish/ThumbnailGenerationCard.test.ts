import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThumbnailGenerationCard } from "@/components/publish/ThumbnailGenerationCard";
import type { ThumbnailView } from "@/lib/thumbnails/thumbnail-view";

const base: ThumbnailView = {
  id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  status: "succeeded",
  platform: "youtube",
  source: "ai_generated",
  textMode: "clean",
  headlineText: null,
  width: 1536,
  height: 1024,
  isFavorite: false,
  estimatedCostCents: 19,
  actualCostCents: 17,
  errorCategory: null,
  safeErrorMessage: null,
  hasAsset: true,
  originLabel: "Text-free",
  createdAtLabel: "2026-09-10 12:00 UTC",
};

const uploaded: ThumbnailView = {
  ...base,
  source: "user_uploaded",
  textMode: null,
  estimatedCostCents: 0,
  actualCostCents: 0,
  originLabel: "Uploaded",
};

function render(thumbnail: ThumbnailView) {
  return renderToStaticMarkup(
    createElement(ThumbnailGenerationCard, {
      projectId: "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      thumbnail,
      canManage: true,
      busy: false,
      onToggleFavorite: () => undefined,
      onRegenerate: () => undefined,
      onDismiss: () => undefined,
      onDelete: () => undefined,
    }),
  );
}

describe("an uploaded thumbnail", () => {
  it("says it was uploaded rather than describing a text mode", () => {
    // The creator's own file may contain text, so "Text-free" would be an
    // unchecked claim about what is inside it.
    const html = render(uploaded);
    expect(html).toContain("Uploaded");
    expect(html).not.toContain("Text-free");
    expect(html).not.toContain("Headline baked in");
  });

  it("reports no cost instead of a settled zero", () => {
    // Nothing was bought, so the gallery should not imply a purchase at all.
    expect(render(uploaded)).toContain("Free");
  });

  it("is never offered a regenerate action, because there is no prompt", () => {
    const failedUpload = render({ ...uploaded, status: "failed" });
    expect(failedUpload).not.toContain("Regenerate");
  });

  it("still offers download and deletion like any other thumbnail", () => {
    const html = render(uploaded);
    expect(html).toContain("Download");
    expect(html).toContain(
      `/api/projects/6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b/thumbnails/${uploaded.id}/asset`,
    );
    // Deleting an upload matters more than deleting a generation: it is the
    // only way to take back a file that was chosen by mistake.
    expect(html).toContain("Delete Uploaded");
  });

  it("can be deleted after a failure too, even without a regenerate action", () => {
    const html = render({ ...uploaded, status: "failed" });
    expect(html).toContain("Delete Uploaded");
    expect(html).not.toContain("Regenerate");
  });
});

describe("a generated thumbnail is unchanged", () => {
  it("still shows its text mode and its actual cost", () => {
    const html = render(base);
    expect(html).toContain("Text-free");
    expect(html).toContain("$0.17");
    expect(html).not.toContain("Free");
  });

  it("still offers regenerate once it has failed", () => {
    expect(render({ ...base, status: "failed" })).toContain("Regenerate");
  });
});
