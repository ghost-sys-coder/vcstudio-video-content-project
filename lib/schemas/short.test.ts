import { describe, expect, it } from "vitest";
import { createShortCompositionSchema } from "@/lib/schemas/short";

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
