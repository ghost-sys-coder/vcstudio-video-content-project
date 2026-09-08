import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { appendReusedMedia } from "./scene-revision-media.repository";

const reused: {
  id: string;
  sceneVersionId: string;
  size: string;
  reviewStatus: string;
  status: string;
  assetObjectKey: string | null;
} = {
  id: "old",
  sceneVersionId: "current",
  size: "1536x1024",
  reviewStatus: "approved",
  status: "succeeded",
  assetObjectKey: "old.png",
};
describe("media selection for revisions", () => {
  it("uses a new approved replacement at the same size", () => {
    const replacement = { ...reused, id: "new", assetObjectKey: "new.png" };
    expect(appendReusedMedia([replacement], [reused])).toEqual([replacement]);
  });
  it.each(["pending", "rejected"])(
    "keeps the approved image during a %s replacement",
    (reviewStatus) => {
      const candidate = { ...reused, id: "new", reviewStatus };
      expect(appendReusedMedia([candidate], [reused])).toEqual([
        candidate,
        reused,
      ]);
    },
  );
  it("does not hide another size's reused media", () => {
    const other = { ...reused, id: "new", size: "1024x1536" };
    expect(appendReusedMedia([other], [reused])).toHaveLength(2);
  });
  it("does not prefer an unavailable replacement", () => {
    expect(
      appendReusedMedia(
        [{ ...reused, id: "missing", assetObjectKey: null }],
        [reused],
      ),
    ).toHaveLength(2);
  });
});
