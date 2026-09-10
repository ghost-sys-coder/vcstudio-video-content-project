import { describe, expect, it } from "vitest";
import {
  describeExternalFinishingAction,
  describeMissingScope,
  describeOutstandingFinishing,
  isReleaseFullyFinished,
  isStepScopeGranted,
  toFinishingStepView,
  YOUTUBE_FINISHING_STEPS,
  YOUTUBE_FORCE_SSL_SCOPE,
  YOUTUBE_MANAGE_SCOPE,
  YOUTUBE_UPLOAD_SCOPE,
  type FinishingStepState,
} from "@/lib/publishing/youtube-finishing-steps";

const uploadOnly = [YOUTUBE_UPLOAD_SCOPE];

describe("what an upload-only connection can actually do", () => {
  it("can set a thumbnail, because the upload scope covers it", () => {
    // Verified against the thumbnails.set reference: it accepts youtube.upload,
    // so attaching a thumbnail needs no new consent.
    expect(
      isStepScopeGranted({ step: "thumbnail", grantedScopes: uploadOnly }),
    ).toBe(true);
  });

  it("cannot upload captions or change playlists", () => {
    // captions.insert requires force-ssl; playlistItems.insert requires
    // youtube or force-ssl. Neither is implied by an upload grant.
    expect(
      isStepScopeGranted({ step: "captions", grantedScopes: uploadOnly }),
    ).toBe(false);
    expect(
      isStepScopeGranted({ step: "playlist", grantedScopes: uploadOnly }),
    ).toBe(false);
  });

  it("can do everything with the broader grant", () => {
    for (const step of YOUTUBE_FINISHING_STEPS)
      expect(
        isStepScopeGranted({
          step,
          grantedScopes: [YOUTUBE_FORCE_SSL_SCOPE],
        }),
      ).toBe(true);
  });

  it("accepts the manage scope for playlists but not for captions", () => {
    expect(
      isStepScopeGranted({
        step: "playlist",
        grantedScopes: [YOUTUBE_MANAGE_SCOPE],
      }),
    ).toBe(true);
    expect(
      isStepScopeGranted({
        step: "captions",
        grantedScopes: [YOUTUBE_MANAGE_SCOPE],
      }),
    ).toBe(false);
  });

  it("grants nothing on an empty scope list", () => {
    for (const step of YOUTUBE_FINISHING_STEPS)
      expect(isStepScopeGranted({ step, grantedScopes: [] })).toBe(false);
  });
});

describe("a step this app cannot finish tells a person what to do", () => {
  it("names a concrete action on YouTube for every step", () => {
    for (const step of YOUTUBE_FINISHING_STEPS) {
      const action = describeExternalFinishingAction(step);
      expect(action).toContain("YouTube Studio");
      expect(action.length).toBeGreaterThan(30);
    }
  });

  it("points at the caption export this app already produces", () => {
    expect(describeExternalFinishingAction("captions")).toContain(".srt");
  });

  it("explains a missing permission rather than blaming the creator", () => {
    expect(describeMissingScope("captions")).toContain("uploading only");
    expect(describeMissingScope("playlist")).toContain("uploading only");
  });

  it("attaches the external action to failed and unsupported steps only", () => {
    expect(
      toFinishingStepView({
        step: "captions",
        state: "unsupported",
        detail: null,
      }).externalAction,
    ).not.toBeNull();
    expect(
      toFinishingStepView({ step: "captions", state: "failed", detail: null })
        .externalAction,
    ).not.toBeNull();
    for (const state of ["succeeded", "skipped", "pending"] as const)
      expect(
        toFinishingStepView({ step: "captions", state, detail: null })
          .externalAction,
      ).toBeNull();
  });

  it("does not offer a retry for something retrying cannot fix", () => {
    // An unsupported step is missing a grant or an account capability, so a
    // retry button would only waste the creator's time.
    expect(
      toFinishingStepView({
        step: "captions",
        state: "unsupported",
        detail: null,
      }).retriable,
    ).toBe(false);
    expect(
      toFinishingStepView({ step: "captions", state: "failed", detail: null })
        .retriable,
    ).toBe(true);
  });

  it("carries the safe reason through", () => {
    expect(
      toFinishingStepView({
        step: "thumbnail",
        state: "failed",
        detail: "That image is larger than YouTube's 2MB limit.",
      }).detail,
    ).toContain("2MB");
  });
});

describe("complete never hides unfinished work", () => {
  const finished = (state: FinishingStepState) => [{ state }];

  it("is finished only when every step succeeded or had nothing to do", () => {
    expect(isReleaseFullyFinished(finished("succeeded"))).toBe(true);
    expect(isReleaseFullyFinished(finished("skipped"))).toBe(true);
    expect(
      isReleaseFullyFinished([{ state: "succeeded" }, { state: "skipped" }]),
    ).toBe(true);
  });

  it("is not finished while anything failed, is unsupported, or is pending", () => {
    for (const state of ["failed", "unsupported", "pending"] as const)
      expect(isReleaseFullyFinished([{ state: "succeeded" }, { state }])).toBe(
        false,
      );
  });

  it("is finished when there are no steps at all", () => {
    expect(isReleaseFullyFinished([])).toBe(true);
  });
});

describe("describeOutstandingFinishing", () => {
  const view = (
    step: "thumbnail" | "captions" | "playlist",
    state: FinishingStepState,
  ) => toFinishingStepView({ step, state, detail: null });

  it("says nothing when nothing is outstanding", () => {
    expect(
      describeOutstandingFinishing([view("thumbnail", "succeeded")]),
    ).toBeNull();
  });

  it("names one outstanding step", () => {
    expect(
      describeOutstandingFinishing([view("captions", "unsupported")]),
    ).toBe("The caption track still needs finishing.");
  });

  it("lists several readably", () => {
    const described = describeOutstandingFinishing([
      view("thumbnail", "failed"),
      view("captions", "unsupported"),
      view("playlist", "pending"),
    ]);
    expect(described).toContain("custom thumbnail");
    expect(described).toContain("and playlist");
  });
});
