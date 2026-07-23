import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ContentIdea } from "@/db/schema";
import { groupIdeasByNiche, toSavedIdeaView } from "@/lib/ideas/ideas-view";

function idea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: "id",
    workspaceId: "ws",
    generationRunId: null,
    niche: "personal finance",
    topic: "topic",
    targetAudience: "audience",
    tone: "tone",
    targetDurationSeconds: 45,
    primaryPlatform: "youtube",
    hookAngle: "hook",
    rationale: "rationale",
    hookType: "quick-win",
    source: "ai",
    isArchived: false,
    createdByUserId: "user",
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("toSavedIdeaView", () => {
  it("projects only the fields the UI needs and a formatted date", () => {
    const view = toSavedIdeaView(idea({ id: "abc" }));
    expect(view.id).toBe("abc");
    expect(view.primaryPlatform).toBe("youtube");
    expect(view.createdAtLabel).toMatch(/2026/);
    expect(view).not.toHaveProperty("workspaceId");
  });
});

describe("groupIdeasByNiche", () => {
  it("groups ideas by niche while preserving input order", () => {
    const groups = groupIdeasByNiche(
      [
        idea({ id: "1", niche: "fitness" }),
        idea({ id: "2", niche: "cooking" }),
        idea({ id: "3", niche: "fitness" }),
      ].map(toSavedIdeaView),
    );
    expect(groups.map((group) => group.niche)).toEqual(["fitness", "cooking"]);
    const fitness = groups.find((group) => group.niche === "fitness");
    expect(fitness?.ideas.map((entry) => entry.id)).toEqual(["1", "3"]);
  });

  it("returns an empty array with no ideas", () => {
    expect(groupIdeasByNiche([])).toEqual([]);
  });
});
