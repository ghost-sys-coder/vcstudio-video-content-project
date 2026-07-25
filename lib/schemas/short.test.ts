import { describe, expect, it } from "vitest";
import {
  createShortCompositionSchema,
  updateShortCompositionSchema,
} from "@/lib/schemas/short";

const id = "11111111-1111-4111-8111-111111111111";

describe("createShortCompositionSchema", () => {
  it("accepts precise ordered clip ranges", () => {
    expect(
      createShortCompositionSchema.safeParse({
        projectId: id,
        outputVariantId: id,
        name: "Debt lesson short",
        clips: [
          {
            sourceSceneId: id,
            sourceSceneVersionId: id,
            position: 1,
            sourceStartMilliseconds: 1200,
            sourceEndMilliseconds: 6400,
            transition: "cut",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate positions and inverted ranges", () => {
    const clip = {
      sourceSceneId: id,
      sourceSceneVersionId: id,
      position: 1,
      sourceStartMilliseconds: 6400,
      sourceEndMilliseconds: 1200,
      transition: "cut",
    } as const;
    expect(
      createShortCompositionSchema.safeParse({
        projectId: id,
        outputVariantId: id,
        name: "Invalid",
        clips: [clip, clip],
      }).success,
    ).toBe(false);
  });
});

describe("updateShortCompositionSchema", () => {
  it("accepts a replacement clip list for an existing composition", () => {
    expect(
      updateShortCompositionSchema.safeParse({
        shortCompositionId: id,
        projectId: id,
        outputVariantId: id,
        name: "Debt lesson short",
        clips: [
          {
            sourceSceneId: id,
            sourceSceneVersionId: id,
            position: 1,
            sourceStartMilliseconds: 1200,
            sourceEndMilliseconds: 6400,
            transition: "fade",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("requires shortCompositionId and still rejects duplicate positions", () => {
    const clip = {
      sourceSceneId: id,
      sourceSceneVersionId: id,
      position: 1,
      sourceStartMilliseconds: 1200,
      sourceEndMilliseconds: 6400,
      transition: "cut",
    } as const;
    expect(
      updateShortCompositionSchema.safeParse({
        projectId: id,
        outputVariantId: id,
        name: "Missing id",
        clips: [clip],
      }).success,
    ).toBe(false);
    expect(
      updateShortCompositionSchema.safeParse({
        shortCompositionId: id,
        projectId: id,
        outputVariantId: id,
        name: "Duplicate positions",
        clips: [clip, clip],
      }).success,
    ).toBe(false);
  });
});
