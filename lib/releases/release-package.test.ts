import { describe, expect, it } from "vitest";
import {
  describeReleaseDestination,
  nextReleaseRevisionNumber,
  releasePackageKey,
  resolveReleasePackageState,
  resolveReleaseTitle,
} from "@/lib/releases/release-package";

const OUTPUT = "11111111-1111-4111-8111-111111111111";
const SHORT = "22222222-2222-4222-8222-222222222222";
const CHANNEL_A = "33333333-3333-4333-8333-333333333333";
const CHANNEL_B = "44444444-4444-4444-8444-444444444444";
const RENDER = "55555555-5555-4555-8555-555555555555";
const NEWER = "66666666-6666-4666-8666-666666666666";

function key(
  target: Partial<{
    outputVariantId: string;
    shortCompositionId: string | null;
  }>,
  destination: Partial<{
    platform: "youtube" | "tiktok" | "facebook" | "instagram";
    channelProfileId: string | null;
  }>,
) {
  return releasePackageKey({
    target: { outputVariantId: OUTPUT, shortCompositionId: null, ...target },
    destination: {
      platform: "youtube",
      channelProfileId: null,
      ...destination,
    },
  });
}

describe("one destination's copy never leaks into another", () => {
  it("gives two channels on the same platform different packages", () => {
    // The defect this fixes: metadata was keyed by platform, so a second
    // YouTube channel overwrote the first channel's title and description.
    expect(key({}, { channelProfileId: CHANNEL_A })).not.toBe(
      key({}, { channelProfileId: CHANNEL_B }),
    );
  });

  it("separates a Short from the long-form video it came from", () => {
    expect(key({ shortCompositionId: SHORT }, {})).not.toBe(key({}, {}));
  });

  it("separates two platforms", () => {
    expect(key({}, { platform: "youtube" })).not.toBe(
      key({}, { platform: "tiktok" }),
    );
  });

  it("does not confuse an unchosen channel with a chosen one", () => {
    expect(key({}, { channelProfileId: null })).not.toBe(
      key({}, { channelProfileId: CHANNEL_A }),
    );
  });

  it("is stable for the same destination", () => {
    expect(key({}, { channelProfileId: CHANNEL_A })).toBe(
      key({}, { channelProfileId: CHANNEL_A }),
    );
  });
});

describe("describeReleaseDestination", () => {
  it("names the channel so it can be confirmed before dispatch", () => {
    expect(
      describeReleaseDestination({
        platformLabel: "YouTube",
        channelName: "Money Made Clear",
      }),
    ).toBe("YouTube · Money Made Clear");
  });

  it("says plainly when no channel is chosen rather than implying one", () => {
    expect(
      describeReleaseDestination({
        platformLabel: "YouTube",
        channelName: null,
      }),
    ).toBe("YouTube · no channel chosen");
  });
});

describe("a favourite is a suggestion, not a decision", () => {
  const suggestions = [
    { id: "a", text: "First idea", isFavorite: false },
    { id: "b", text: "Favourited idea", isFavorite: true },
  ];

  it("keeps the chosen title when the favourite changes afterwards", () => {
    // The rule that matters: a release must publish what somebody chose, not
    // whatever happens to be favourited at dispatch time.
    const chosen = { packageTitle: "What we actually chose", suggestions };
    expect(resolveReleaseTitle(chosen)).toEqual({
      title: "What we actually chose",
      source: "chosen",
    });
    const movedFavorite = [
      { id: "a", text: "First idea", isFavorite: true },
      { id: "b", text: "Favourited idea", isFavorite: false },
    ];
    expect(
      resolveReleaseTitle({ ...chosen, suggestions: movedFavorite }).title,
    ).toBe("What we actually chose");
  });

  it("offers the favourite only when nothing has been chosen", () => {
    expect(resolveReleaseTitle({ packageTitle: "", suggestions })).toEqual({
      title: "Favourited idea",
      source: "suggested",
    });
  });

  it("treats whitespace as no title at all", () => {
    expect(
      resolveReleaseTitle({ packageTitle: "   ", suggestions }).source,
    ).toBe("suggested");
  });

  it("reports nothing rather than inventing a title", () => {
    expect(resolveReleaseTitle({ packageTitle: "", suggestions: [] })).toEqual({
      title: "",
      source: "none",
    });
  });
});

describe("resolveReleasePackageState", () => {
  const ready = {
    platform: "youtube" as const,
    title: "A title",
    caption: null,
    thumbnailChosen: true,
    thumbnailAvailable: true,
    latestRenderId: RENDER,
    reviewedRenderId: RENDER,
  };

  it("is ready when everything has been decided and reviewed", () => {
    const state = resolveReleasePackageState(ready);
    expect(state.status).toBe("ready");
    expect(state.canDispatch).toBe(true);
    expect(state.blockers).toEqual([]);
  });

  it("refuses to dispatch without a title", () => {
    const state = resolveReleasePackageState({ ...ready, title: "  " });
    expect(state.canDispatch).toBe(false);
    expect(state.blockers.map((blocker) => blocker.code)).toContain(
      "title_missing",
    );
  });

  it("refuses to dispatch before anything has been rendered", () => {
    // Planning a title and thumbnail early is allowed; sending them is not.
    const state = resolveReleasePackageState({
      ...ready,
      latestRenderId: null,
      reviewedRenderId: null,
    });
    expect(state.canDispatch).toBe(false);
    expect(state.blockers.map((blocker) => blocker.code)).toContain(
      "no_render",
    );
  });

  it("goes stale when a newer render appears, and does not adopt it", () => {
    // Source content moved underneath the packaging. Reconfirmation is the
    // creator's decision, so nothing here quietly accepts the new render.
    const state = resolveReleasePackageState({
      ...ready,
      latestRenderId: NEWER,
    });
    expect(state.status).toBe("stale");
    expect(state.canDispatch).toBe(false);
    expect(
      state.blockers.find((blocker) => blocker.code === "stale_render")
        ?.message,
    ).toContain("newer render");
  });

  it("asks for a first review when the package has never been confirmed", () => {
    const state = resolveReleasePackageState({
      ...ready,
      reviewedRenderId: null,
    });
    expect(state.blockers.map((blocker) => blocker.code)).toContain(
      "stale_render",
    );
    expect(
      state.blockers.find((blocker) => blocker.code === "stale_render")
        ?.message,
    ).not.toContain("newer render");
  });

  it("goes stale when the chosen thumbnail is gone", () => {
    const state = resolveReleasePackageState({
      ...ready,
      thumbnailAvailable: false,
    });
    expect(state.status).toBe("stale");
    expect(state.blockers.map((blocker) => blocker.code)).toContain(
      "thumbnail_unavailable",
    );
  });

  it("does not treat choosing no thumbnail as a problem", () => {
    // Not every platform needs a custom cover, and declining one is a decision.
    const state = resolveReleasePackageState({
      ...ready,
      thumbnailChosen: false,
      thumbnailAvailable: false,
    });
    expect(state.canDispatch).toBe(true);
  });

  it("requires an Instagram caption, matching what the database enforces", () => {
    const state = resolveReleasePackageState({
      ...ready,
      platform: "instagram",
      caption: "",
    });
    expect(state.canDispatch).toBe(false);
    expect(state.blockers.map((blocker) => blocker.code)).toContain(
      "caption_missing",
    );
  });

  it("does not demand a caption from platforms that have no caption field", () => {
    expect(
      resolveReleasePackageState({
        ...ready,
        platform: "youtube",
        caption: null,
      }).canDispatch,
    ).toBe(true);
  });

  it("reports every blocker at once rather than one at a time", () => {
    const state = resolveReleasePackageState({
      ...ready,
      title: "",
      latestRenderId: null,
    });
    expect(state.blockers.length).toBeGreaterThanOrEqual(2);
  });
});

describe("nextReleaseRevisionNumber", () => {
  it("starts at one", () => {
    expect(nextReleaseRevisionNumber([])).toBe(1);
  });

  it("continues past the highest frozen revision, not the count", () => {
    // Revisions are never deleted, but a gap must not reissue a used number.
    expect(nextReleaseRevisionNumber([1, 2, 5])).toBe(6);
  });

  it("is unaffected by the order it is given", () => {
    expect(nextReleaseRevisionNumber([5, 1, 2])).toBe(6);
  });
});
