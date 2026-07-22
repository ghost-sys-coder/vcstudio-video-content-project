import { describe, expect, it } from "vitest";
import {
  getOutputVariantDefinition,
  OUTPUT_VARIANT_DEFINITIONS,
} from "@/lib/output-variants/output-variant";

describe("output variants", () => {
  it("defines exactly one supported output for every project aspect ratio", () => {
    expect(OUTPUT_VARIANT_DEFINITIONS.map((item) => item.aspectRatio)).toEqual([
      "16:9",
      "9:16",
      "1:1",
    ]);
  });

  it("returns fixed platform-safe dimensions", () => {
    expect(getOutputVariantDefinition("9:16")).toMatchObject({
      width: 1080,
      height: 1920,
    });
    expect(getOutputVariantDefinition("1:1")).toMatchObject({
      width: 1080,
      height: 1080,
    });
  });
});
