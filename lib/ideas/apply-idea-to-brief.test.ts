import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/commands/project-brief.command", () => ({
  saveProjectBrief: vi.fn(async () => {}),
}));
vi.mock("@/db/repositories/content-ideas.repository", () => ({
  findContentIdea: vi.fn(),
}));
vi.mock("@/db/repositories/projects.repository", () => ({
  findProject: vi.fn(),
}));

import { saveProjectBrief } from "@/db/commands/project-brief.command";
import { findContentIdea } from "@/db/repositories/content-ideas.repository";
import { findProject } from "@/db/repositories/projects.repository";
import {
  applyIdeaToBrief,
  ApplyIdeaError,
} from "@/lib/ideas/apply-idea-to-brief";

const input = {
  workspaceId: "ws-1",
  userId: "user-1",
  projectId: "proj-1",
  ideaId: "idea-1",
};

const idea = {
  id: "idea-1",
  niche: "history",
  topic: "topic",
  targetAudience: "audience",
  tone: "tone",
  targetDurationSeconds: 45,
  primaryPlatform: "tiktok",
  hookAngle: "hook",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyIdeaToBrief", () => {
  it("copies the idea's fields into the project brief when both belong to the workspace", async () => {
    vi.mocked(findProject).mockResolvedValue({ id: "proj-1" } as never);
    vi.mocked(findContentIdea).mockResolvedValue(idea as never);

    await applyIdeaToBrief(input);

    expect(saveProjectBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        projectId: "proj-1",
        topic: "topic",
        primaryPlatform: "tiktok",
        targetDurationSeconds: 45,
        niche: "history",
        userId: "user-1",
      }),
    );
  });

  it("refuses and does not write when the idea is foreign or missing", async () => {
    vi.mocked(findProject).mockResolvedValue({ id: "proj-1" } as never);
    vi.mocked(findContentIdea).mockResolvedValue(null);

    await expect(applyIdeaToBrief(input)).rejects.toBeInstanceOf(
      ApplyIdeaError,
    );
    expect(saveProjectBrief).not.toHaveBeenCalled();
  });

  it("refuses when the project is foreign or missing", async () => {
    vi.mocked(findProject).mockResolvedValue(null as never);
    vi.mocked(findContentIdea).mockResolvedValue(idea as never);

    await expect(applyIdeaToBrief(input)).rejects.toBeInstanceOf(
      ApplyIdeaError,
    );
    expect(saveProjectBrief).not.toHaveBeenCalled();
  });
});
