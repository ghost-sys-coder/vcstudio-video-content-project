import { describe, expect, it } from "vitest";
import {
  assignSceneCharactersSchema,
  characterFormSchema,
  createCharacterReferenceUploadSchema,
} from "@/lib/schemas/character";

describe("character schemas", () => {
  it("rejects archived status from editable forms", () => {
    expect(
      characterFormSchema.safeParse({ name: "Ada", status: "archived" })
        .success,
    ).toBe(false);
  });

  it("enforces reference type and five megabyte limit", () => {
    const schema = createCharacterReferenceUploadSchema({
      allowedTypes: ["image/png", "image/jpeg", "image/webp"],
      maximumBytes: 5 * 1024 * 1024,
    });
    expect(
      schema.safeParse({
        type: "master",
        contentType: "image/png",
        fileName: "ada.png",
        sizeBytes: 1024,
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        type: "master",
        contentType: "image/gif",
        fileName: "ada.gif",
        sizeBytes: 1024,
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        type: "master",
        contentType: "image/png",
        fileName: "ada.png",
        sizeBytes: 5 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });

  it("bounds scene character assignments", () => {
    expect(
      assignSceneCharactersSchema.safeParse({
        projectId: crypto.randomUUID(),
        sceneId: crypto.randomUUID(),
        sceneVersionId: crypto.randomUUID(),
        characterIds: [],
      }).success,
    ).toBe(true);
  });
});
