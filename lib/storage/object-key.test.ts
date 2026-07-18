import { describe, expect, it } from "vitest";
import {
  createCharacterReferenceObjectKey,
  createSceneImageObjectKey,
  createVideoExportObjectKey,
  isCharacterReferenceObjectKey,
  isSceneImageObjectKey,
  isVideoExportObjectKey,
  createWorkspaceLogoObjectKey,
  isWorkspaceLogoObjectKey,
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
