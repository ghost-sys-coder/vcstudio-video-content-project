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
  // A scene may hold several approved images at one size, distinguished only by
  // shot. Keyed on size alone, approving a new first shot suppressed the
  // carried-forward second one and the scene quietly lost a picture.
  it("does not hide another shot at the same size", () => {
    const secondShot = { ...reused, id: "old-shot-1", shotIndex: 1 };
    const firstShot = { ...reused, id: "new-shot-0", shotIndex: 0 };
    expect(appendReusedMedia([firstShot], [secondShot])).toEqual([
      firstShot,
      secondShot,
    ]);
  });

  it("still replaces the same shot at the same size", () => {
    const before = { ...reused, id: "old", shotIndex: 1 };
    const after = { ...reused, id: "new", shotIndex: 1 };
    expect(appendReusedMedia([after], [before])).toEqual([after]);
  });

  // Rows written before shots existed carry no index and must keep behaving as
  // the first shot rather than becoming a distinct image.
  it("treats a missing shot index as the first shot", () => {
    const withoutIndex = { ...reused, id: "new" };
    const withZero = { ...reused, id: "old", shotIndex: 0 };
    expect(appendReusedMedia([withoutIndex], [withZero])).toEqual([
      withoutIndex,
    ]);
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
