import { describe, expect, it } from "vitest";
import {
  resolveProductionReadiness,
  type ProjectProductionFacts,
} from "@/lib/production/production-readiness";

function facts(
  overrides: Partial<ProjectProductionFacts> = {},
): ProjectProductionFacts {
  return {
    projectId: "project-1",
    hasApprovedScript: false,
    hasScriptDraft: false,
    sceneCount: 0,
    scenesAwaitingReview: 0,
    imagesSucceeded: 0,
    imagesAwaitingReview: 0,
    imagesFailed: 0,
    scenesWithoutApprovedImage: 0,
    audioSucceeded: 0,
    audioAwaitingReview: 0,
    audioFailed: 0,
    rendersSucceeded: 0,
    rendersFailed: 0,
    rendersInFlight: 0,
    publicationsSucceeded: 0,
    publicationsFailed: 0,
    plannedReleaseAt: null,
    ...overrides,
  };
}

/** A project whose production work is genuinely finished. */
function finished(
  overrides: Partial<ProjectProductionFacts> = {},
): ProjectProductionFacts {
  return facts({
    hasApprovedScript: true,
    sceneCount: 4,
    imagesSucceeded: 4,
    audioSucceeded: 4,
    rendersSucceeded: 1,
    ...overrides,
  });
}

describe("readiness is derived from evidence, never from a typed status", () => {
  it("does not expose any input for a manually set project status", () => {
    // The guard behind "manual Settings status cannot manufacture readiness".
    // Project settings lets a creator set `projects.status` by hand, so the
    // fact type must offer nowhere to put it. If someone adds a status field
    // here, this test is where they are asked to justify it.
    expect(Object.keys(facts())).not.toContain("status");
  });

  it("treats an empty project as unready no matter what it might be labelled", () => {
    const readiness = resolveProductionReadiness(facts());
    expect(readiness.isComplete).toBe(false);
    expect(readiness.stage).toBe("script");
    expect(readiness.releaseState).toBe("unpublished");
    expect(readiness.blockers[0]?.kind).toBe("script_missing");
  });

  it("counts a rendered project as complete even with no editorial ceremony", () => {
    const readiness = resolveProductionReadiness(finished());
    expect(readiness.isComplete).toBe(true);
    expect(readiness.releaseState).toBe("rendered");
    expect(readiness.blockers).toHaveLength(0);
  });
});

describe("release states stay distinct", () => {
  it("separates unpublished, scheduled, rendered and published", () => {
    expect(resolveProductionReadiness(facts()).releaseState).toBe(
      "unpublished",
    );
    expect(
      resolveProductionReadiness(facts({ plannedReleaseAt: new Date() }))
        .releaseState,
    ).toBe("scheduled");
    expect(resolveProductionReadiness(finished()).releaseState).toBe(
      "rendered",
    );
    expect(
      resolveProductionReadiness(finished({ publicationsSucceeded: 1 }))
        .releaseState,
    ).toBe("published");
  });

  it("does not let a planned date outrank a real render or publication", () => {
    // Intent must never overstate progress.
    const scheduledAndRendered = finished({ plannedReleaseAt: new Date() });
    expect(resolveProductionReadiness(scheduledAndRendered).releaseState).toBe(
      "rendered",
    );
    expect(
      resolveProductionReadiness({
        ...scheduledAndRendered,
        publicationsSucceeded: 1,
      }).releaseState,
    ).toBe("published");
  });

  it("reports a published project as needing nothing further", () => {
    const readiness = resolveProductionReadiness(
      finished({ publicationsSucceeded: 1 }),
    );
    expect(readiness.stage).toBe("release");
    expect(readiness.nextAction).toBeNull();
  });
});

describe("a partial batch failure cannot become a success", () => {
  it("keeps a project incomplete when some images failed", () => {
    // Three of four scenes have imagery and the fourth failed. The project
    // must not read as finished, and the failure must be named rather than
    // folded into a count of missing images.
    const readiness = resolveProductionReadiness(
      finished({ imagesSucceeded: 3, imagesFailed: 1 }),
    );
    expect(readiness.isComplete).toBe(false);
    expect(readiness.blockers.map((entry) => entry.kind)).toContain(
      "images_failed",
    );
    expect(readiness.blockers[0]?.message).toBe("1 image failed to generate.");
  });

  it("reports failed images separately from images never requested", () => {
    const failed = resolveProductionReadiness(
      finished({ imagesFailed: 2, scenesWithoutApprovedImage: 2 }),
    );
    expect(failed.blockers.map((entry) => entry.kind)).toContain(
      "images_failed",
    );
    expect(failed.blockers.map((entry) => entry.kind)).not.toContain(
      "images_missing",
    );

    const missing = resolveProductionReadiness(
      finished({ imagesSucceeded: 2, scenesWithoutApprovedImage: 2 }),
    );
    expect(missing.blockers.map((entry) => entry.kind)).toContain(
      "images_missing",
    );
  });

  it("keeps a failed render visible until a render actually succeeds", () => {
    const failed = resolveProductionReadiness(
      finished({ rendersSucceeded: 0, rendersFailed: 1 }),
    );
    expect(failed.blockers.map((entry) => entry.kind)).toContain(
      "render_failed",
    );
    expect(failed.isComplete).toBe(false);

    // A later successful render resolves it rather than leaving a stale alarm.
    const recovered = resolveProductionReadiness(
      finished({ rendersSucceeded: 1, rendersFailed: 1 }),
    );
    expect(recovered.blockers.map((entry) => entry.kind)).not.toContain(
      "render_failed",
    );
    expect(recovered.isComplete).toBe(true);
  });

  it("keeps an outstanding review out of a complete verdict", () => {
    const readiness = resolveProductionReadiness(
      finished({ imagesAwaitingReview: 3 }),
    );
    expect(readiness.isComplete).toBe(false);
  });
});

describe("the next action points at the actual problem", () => {
  it("names the review count and links to where it is resolved", () => {
    // The acceptance example: "3 images awaiting review" with a recovery link.
    const readiness = resolveProductionReadiness(
      finished({ imagesAwaitingReview: 3 }),
    );
    const review = readiness.reviews.find(
      (entry) => entry.kind === "images_awaiting_review",
    );
    expect(review?.message).toBe("3 images awaiting review");
    expect(review?.action.href).toBe("storyboard");
    expect(readiness.nextAction?.href).toBe("storyboard");
  });

  it("says 'The render failed' and links to the render page", () => {
    const readiness = resolveProductionReadiness(
      finished({ rendersSucceeded: 0, rendersFailed: 1 }),
    );
    expect(
      readiness.blockers.find((entry) => entry.kind === "render_failed")
        ?.message,
    ).toBe("The render failed.");
    expect(readiness.nextAction?.href).toBe("render");
  });

  it("prefers a blocking failure over a pending review", () => {
    const readiness = resolveProductionReadiness(
      finished({
        imagesAwaitingReview: 3,
        rendersFailed: 1,
        rendersSucceeded: 0,
      }),
    );
    expect(readiness.nextAction?.href).toBe("render");
  });

  it("sends a finished but unpublished project to publish", () => {
    expect(resolveProductionReadiness(finished()).nextAction?.href).toBe(
      "publish",
    );
  });

  it("distinguishes an unwritten script from an unapproved one", () => {
    expect(resolveProductionReadiness(facts()).blockers[0]?.kind).toBe(
      "script_missing",
    );
    expect(
      resolveProductionReadiness(facts({ hasScriptDraft: true })).blockers[0]
        ?.kind,
    ).toBe("script_unapproved");
  });

  it("asks for scene analysis once a script is approved but no scenes exist", () => {
    const readiness = resolveProductionReadiness(
      facts({ hasApprovedScript: true }),
    );
    expect(readiness.blockers[0]?.kind).toBe("scenes_missing");
    expect(readiness.nextAction?.href).toBe("scenes");
  });
});

describe("stage reflects what exists", () => {
  it("advances only as far as real output allows", () => {
    expect(resolveProductionReadiness(facts()).stage).toBe("script");
    expect(
      resolveProductionReadiness(
        facts({ hasApprovedScript: true, sceneCount: 3 }),
      ).stage,
    ).toBe("scenes");
    expect(
      resolveProductionReadiness(
        facts({ hasApprovedScript: true, sceneCount: 3, imagesSucceeded: 1 }),
      ).stage,
    ).toBe("storyboard");
    expect(
      resolveProductionReadiness(
        facts({
          hasApprovedScript: true,
          sceneCount: 3,
          imagesSucceeded: 3,
          audioSucceeded: 1,
        }),
      ).stage,
    ).toBe("audio");
    expect(resolveProductionReadiness(finished()).stage).toBe("render");
  });

  it("treats a render still running as the render stage", () => {
    expect(
      resolveProductionReadiness(
        finished({ rendersSucceeded: 0, rendersInFlight: 1 }),
      ).stage,
    ).toBe("render");
  });
});
