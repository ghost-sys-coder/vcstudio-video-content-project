import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  listConnections: vi.fn(),
  listPublications: vi.fn(),
  listRenders: vi.fn(),
  findMetadataRun: vi.fn(),
  listSuggestions: vi.fn(),
}));

vi.mock("@/db/repositories/publishing.repository", () => ({
  listPlatformConnections: mocks.listConnections,
  listProjectVideoPublications: mocks.listPublications,
}));
vi.mock("@/db/repositories/video-render.repository", () => ({
  listVideoRenders: mocks.listRenders,
}));
vi.mock("@/db/repositories/title-generation.repository", () => ({
  findLatestCompletedTitleGenerationRunForPlatform: mocks.findMetadataRun,
  listTitleSuggestionsForRuns: mocks.listSuggestions,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({
    ENABLE_VIDEO_PUBLISHING: true,
    MAX_PUBLISH_VIDEO_BYTES: 1_073_741_824,
  }),
}));
vi.mock("@/lib/publishing/provider-registry", () => ({
  PUBLISHABLE_PLATFORMS: ["youtube", "facebook", "instagram", "tiktok"],
}));
vi.mock("@/lib/titles/title-view", () => ({
  CONTENT_PLATFORM_LABELS: {
    youtube: "YouTube",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
  },
}));

import { loadPublishingView } from "@/lib/publishing/publishing-view";

describe("publishing view generated metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listConnections.mockResolvedValue([]);
    mocks.listPublications.mockResolvedValue([]);
    mocks.listRenders.mockResolvedValue([]);
    mocks.findMetadataRun.mockImplementation(
      ({ platform }: { platform: string }) =>
        Promise.resolve(
          platform === "youtube"
            ? {
                id: "run-id",
                platform: "youtube",
                generatedDescription: "Generated description",
                generatedTags: ["#Money", "money", "debt strategy"],
              }
            : null,
        ),
    );
    mocks.listSuggestions.mockResolvedValue([
      {
        titleGenerationRunId: "run-id",
        text: "First title",
        position: 0,
        isFavorite: false,
      },
      {
        titleGenerationRunId: "run-id",
        text: "Favorite title",
        position: 1,
        isFavorite: true,
      },
    ]);
  });

  it("returns the preferred title and normalized durable metadata", async () => {
    const view = await loadPublishingView({
      workspaceId: "workspace-id",
      project: {
        id: "project-id",
        workspaceId: "workspace-id",
        name: "Project",
        description: "",
        status: "draft",
        aspectRatio: "16:9",
        width: 1920,
        height: 1080,
        framesPerSecond: 30,
        language: "English",
        maximumBudgetCents: 1000,
        createdByUserId: "user-id",
        archivedAt: null,
        createdAt: new Date("2026-07-22T00:00:00Z"),
        updatedAt: new Date("2026-07-22T00:00:00Z"),
      },
    });

    expect(view.generatedMetadata).toEqual([
      {
        generationRunId: "run-id",
        platform: "youtube",
        title: "Favorite title",
        description: "Generated description",
        tags: ["Money", "debt strategy"],
      },
    ]);
    expect(mocks.listSuggestions).toHaveBeenCalledWith({
      workspaceId: "workspace-id",
      projectId: "project-id",
      titleGenerationRunIds: ["run-id"],
    });
  });

  it("exposes the persisted connection and render for active-state restoration", async () => {
    mocks.listPublications.mockResolvedValue([
      {
        id: "publication-id",
        connectionId: "youtube-connection",
        renderId: "render-id",
        platform: "youtube",
        title: "Published title",
        status: "uploading",
        visibility: "public",
        progressPercent: 42,
        externalVideoUrl: null,
        safeErrorMessage: null,
        providerOperationStage: "uploading",
        createdAt: new Date("2026-07-22T01:00:00Z"),
      },
    ]);

    const view = await loadPublishingView({
      workspaceId: "workspace-id",
      project: {
        id: "project-id",
        workspaceId: "workspace-id",
        name: "Project",
        description: "",
        status: "draft",
        aspectRatio: "16:9",
        width: 1920,
        height: 1080,
        framesPerSecond: 30,
        language: "English",
        maximumBudgetCents: 1000,
        createdByUserId: "user-id",
        archivedAt: null,
        createdAt: new Date("2026-07-22T00:00:00Z"),
        updatedAt: new Date("2026-07-22T00:00:00Z"),
      },
    });

    expect(view.publications[0]).toEqual(
      expect.objectContaining({
        id: "publication-id",
        connectionId: "youtube-connection",
        renderId: "render-id",
        status: "uploading",
      }),
    );
  });
});
