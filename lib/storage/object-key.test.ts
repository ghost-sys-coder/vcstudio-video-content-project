import { describe, expect, it } from "vitest";
import {
  createCharacterReferenceObjectKey,
  createSceneImageObjectKey,
  createThumbnailObjectKey,
  createVideoExportObjectKey,
  isCharacterReferenceObjectKey,
  isSceneImageObjectKey,
  isThumbnailObjectKey,
  isVideoExportObjectKey,
  createWorkspaceLogoObjectKey,
  isWorkspaceLogoObjectKey,
  createMediaLibraryObjectKey,
  isMediaLibraryObjectKey,
  createProjectAssetPrefix,
} from "@/lib/storage/object-key";

const workspaceId = "00000000-0000-4000-8000-000000000001";

describe("workspace logo object keys", () => {
  it("creates a workspace-scoped branding key", () => {
    expect(
      createWorkspaceLogoObjectKey({ workspaceId, contentType: "image/webp" }),
    ).toMatch(
      /^workspaces\/00000000-0000-4000-8000-000000000001\/branding\/logos\/[0-9a-f-]+\.webp$/,
    );
  });

  it("rejects cross-workspace and traversal keys", () => {
    expect(
      isWorkspaceLogoObjectKey({
        workspaceId,
        objectKey:
          "workspaces/00000000-0000-4000-8000-000000000002/branding/logos/logo.png",
      }),
    ).toBe(false);
    expect(
      isWorkspaceLogoObjectKey({
        workspaceId,
        objectKey: `workspaces/${workspaceId}/branding/logos/../secret.png`,
      }),
    ).toBe(false);
  });
});

describe("scene image object keys", () => {
  const input: Parameters<typeof createSceneImageObjectKey>[0] = {
    workspaceId,
    projectId: "00000000-0000-4000-8000-000000000020",
    sceneId: "00000000-0000-4000-8000-000000000021",
    sceneVersionId: "00000000-0000-4000-8000-000000000022",
    generationId: "00000000-0000-4000-8000-000000000023",
    outputFormat: "webp",
  };

  it("creates a deterministic workspace and scene-version scoped key", () => {
    const objectKey = createSceneImageObjectKey(input);
    expect(objectKey).toBe(
      `workspaces/${workspaceId}/projects/${input.projectId}/scenes/${input.sceneId}/versions/${input.sceneVersionId}/images/${input.generationId}.webp`,
    );
    expect(isSceneImageObjectKey({ ...input, objectKey })).toBe(true);
  });

  it("rejects a key from another workspace or generation", () => {
    const objectKey = createSceneImageObjectKey(input);
    expect(
      isSceneImageObjectKey({
        ...input,
        workspaceId: "00000000-0000-4000-8000-000000000099",
        objectKey,
      }),
    ).toBe(false);
    expect(
      isSceneImageObjectKey({
        ...input,
        generationId: "00000000-0000-4000-8000-000000000098",
        objectKey,
      }),
    ).toBe(false);
  });
});

describe("video export object keys", () => {
  const input = {
    workspaceId,
    projectId: "00000000-0000-4000-8000-000000000030",
    renderId: "00000000-0000-4000-8000-000000000031",
  };

  it("creates a deterministic workspace and project scoped mp4 key", () => {
    const objectKey = createVideoExportObjectKey(input);
    expect(objectKey).toBe(
      `workspaces/${workspaceId}/projects/${input.projectId}/renders/${input.renderId}.mp4`,
    );
    expect(isVideoExportObjectKey({ ...input, objectKey })).toBe(true);
  });

  it("rejects a key from another workspace, project, or render", () => {
    const objectKey = createVideoExportObjectKey(input);
    expect(
      isVideoExportObjectKey({
        ...input,
        workspaceId: "00000000-0000-4000-8000-000000000099",
        objectKey,
      }),
    ).toBe(false);
    expect(
      isVideoExportObjectKey({
        ...input,
        renderId: "00000000-0000-4000-8000-000000000098",
        objectKey,
      }),
    ).toBe(false);
  });
});

describe("character reference object keys", () => {
  const characterId = "00000000-0000-4000-8000-000000000010";

  it("creates a scoped key with reference type", () => {
    const key = createCharacterReferenceObjectKey({
      workspaceId,
      characterId,
      referenceType: "threeQuarter",
      contentType: "image/jpeg",
    });
    expect(key).toMatch(
      /\/characters\/00000000-0000-4000-8000-000000000010\/references\/threeQuarter\/[0-9a-f-]+\.jpg$/,
    );
    expect(
      isCharacterReferenceObjectKey({
        workspaceId,
        characterId,
        referenceType: "threeQuarter",
        objectKey: key,
      }),
    ).toBe(true);
  });

  it("rejects cross-character and traversal keys", () => {
    expect(
      isCharacterReferenceObjectKey({
        workspaceId,
        characterId,
        referenceType: "master",
        objectKey: `workspaces/${workspaceId}/characters/other/references/master/file.png`,
      }),
    ).toBe(false);
    expect(
      isCharacterReferenceObjectKey({
        workspaceId,
        characterId,
        referenceType: "master",
        objectKey: `workspaces/${workspaceId}/characters/${characterId}/references/master/../file.png`,
      }),
    ).toBe(false);
  });
});

describe("thumbnail object keys", () => {
  const projectId = "00000000-0000-4000-8000-00000000000a";
  const thumbnailGenerationId = "00000000-0000-4000-8000-00000000000b";
  const base = {
    workspaceId,
    projectId,
    platform: "youtube",
    thumbnailGenerationId,
    outputFormat: "webp",
  } as const;

  it("creates a workspace/project/platform scoped key", () => {
    expect(createThumbnailObjectKey(base)).toBe(
      `workspaces/${workspaceId}/projects/${projectId}/thumbnails/youtube/${thumbnailGenerationId}.webp`,
    );
  });

  it("sanitizes the platform segment so it cannot escape the prefix", () => {
    expect(createThumbnailObjectKey({ ...base, platform: "../../etc" })).toBe(
      `workspaces/${workspaceId}/projects/${projectId}/thumbnails/-etc/${thumbnailGenerationId}.webp`,
    );
  });

  it("accepts only the exact matching key", () => {
    expect(
      isThumbnailObjectKey({
        ...base,
        objectKey: createThumbnailObjectKey(base),
      }),
    ).toBe(true);
  });

  it("rejects cross-project, cross-platform, and traversal keys", () => {
    expect(
      isThumbnailObjectKey({
        ...base,
        objectKey: `workspaces/${workspaceId}/projects/other/thumbnails/youtube/${thumbnailGenerationId}.webp`,
      }),
    ).toBe(false);
    expect(
      isThumbnailObjectKey({
        ...base,
        objectKey: `workspaces/${workspaceId}/projects/${projectId}/thumbnails/tiktok/${thumbnailGenerationId}.webp`,
      }),
    ).toBe(false);
    expect(
      isThumbnailObjectKey({
        ...base,
        objectKey: `workspaces/${workspaceId}/projects/${projectId}/thumbnails/youtube/../${thumbnailGenerationId}.webp`,
      }),
    ).toBe(false);
  });
});

describe("media library object keys", () => {
  const mediaAssetId = "11111111-1111-4111-8111-111111111111";

  it("derives the key entirely from the asset id and content type", () => {
    expect(
      createMediaLibraryObjectKey({
        workspaceId,
        mediaAssetId,
        contentType: "video/quicktime",
      }),
    ).toBe(`workspaces/${workspaceId}/library/${mediaAssetId}.mov`);
    expect(
      createMediaLibraryObjectKey({
        workspaceId,
        mediaAssetId,
        contentType: "image/jpeg",
      }),
    ).toBe(`workspaces/${workspaceId}/library/${mediaAssetId}.jpg`);
  });

  it("sits outside the project asset prefix, so deleting a project cannot purge it", () => {
    const key = createMediaLibraryObjectKey({
      workspaceId,
      mediaAssetId,
      contentType: "image/png",
    });
    expect(
      key.startsWith(
        createProjectAssetPrefix({ workspaceId, projectId: "any-project" }),
      ),
    ).toBe(false);
    expect(key.includes("/projects/")).toBe(false);
  });

  it("accepts only the exact key this asset and content type produce", () => {
    const base = {
      workspaceId,
      mediaAssetId,
      contentType: "image/png",
    } as const;
    expect(
      isMediaLibraryObjectKey({
        ...base,
        objectKey: `workspaces/${workspaceId}/library/${mediaAssetId}.png`,
      }),
    ).toBe(true);
    // Another workspace's object.
    expect(
      isMediaLibraryObjectKey({
        ...base,
        objectKey: `workspaces/00000000-0000-4000-8000-000000000002/library/${mediaAssetId}.png`,
      }),
    ).toBe(false);
    // Another asset's object.
    expect(
      isMediaLibraryObjectKey({
        ...base,
        objectKey: `workspaces/${workspaceId}/library/22222222-2222-4222-8222-222222222222.png`,
      }),
    ).toBe(false);
    // A mismatched extension.
    expect(
      isMediaLibraryObjectKey({
        ...base,
        objectKey: `workspaces/${workspaceId}/library/${mediaAssetId}.mp4`,
      }),
    ).toBe(false);
    // Traversal.
    expect(
      isMediaLibraryObjectKey({
        ...base,
        objectKey: `workspaces/${workspaceId}/library/../${mediaAssetId}.png`,
      }),
    ).toBe(false);
  });
});
