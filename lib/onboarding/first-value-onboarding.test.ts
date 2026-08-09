import { describe, expect, it } from "vitest";
import { buildFirstValueTracks } from "@/lib/onboarding/first-value-onboarding";

const facts = {
  brandComplete: false,
  budgetConfigured: false,
  publishingConnected: false,
  googleBusinessConnected: false,
  projectCreated: false,
  marketingDraftCreated: false,
  assetApproved: false,
  renderCompleted: false,
  postPublished: false,
};

describe("first-value onboarding", () => {
  it("derives completion from facts", () => {
    const tracks = buildFirstValueTracks({
      facts: { ...facts, projectCreated: true, assetApproved: true },
      role: "owner",
      marketingEnabled: true,
      publishingEnabled: true,
    });
    expect(tracks.find((track) => track.id === "video")?.completedCount).toBe(
      2,
    );
  });

  it("gives viewers observation-only blocked milestones", () => {
    const tracks = buildFirstValueTracks({
      facts,
      role: "viewer",
      marketingEnabled: true,
      publishingEnabled: true,
    });
    expect(
      tracks
        .flatMap((track) => track.milestones)
        .every((milestone) => milestone.complete || milestone.blocked),
    ).toBe(true);
  });

  it("blocks disabled product tracks without changing completion", () => {
    const tracks = buildFirstValueTracks({
      facts,
      role: "owner",
      marketingEnabled: false,
      publishingEnabled: false,
    });
    expect(
      tracks
        .find((track) => track.id === "marketing")
        ?.milestones.every((milestone) => milestone.blocked),
    ).toBe(true);
    expect(
      tracks
        .find((track) => track.id === "social")
        ?.milestones.every((milestone) => milestone.blocked),
    ).toBe(true);
  });
});
