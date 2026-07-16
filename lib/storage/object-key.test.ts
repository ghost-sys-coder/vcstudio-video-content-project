import { describe, expect, it } from "vitest";
import {
  createCharacterReferenceObjectKey,
  isCharacterReferenceObjectKey,
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
