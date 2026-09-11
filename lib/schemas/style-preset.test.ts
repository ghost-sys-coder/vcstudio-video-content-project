import { describe, expect, it } from "vitest";
import {
  addStylePresetFromTemplateSchema,
  createStylePresetSchema,
  updateStylePresetSchema,
} from "@/lib/schemas/style-preset";

const VALID = {
  name: "Cinematic photoreal",
  description: "Believable people, shot like a film.",
  positivePrompt: "Photorealistic cinematic still, natural skin texture.",
  negativePrompt: "illustration, cartoon",
  defaultAspectRatio: "16:9",
};

describe("creating a style", () => {
  it("accepts a complete one", () => {
    const parsed = createStylePresetSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty description and empty exclusions", () => {
    const parsed = createStylePresetSchema.safeParse({
      ...VALID,
      description: "",
      negativePrompt: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses an empty visual direction, which would contribute nothing", () => {
    // A style with no positive direction still appears in every picker and
    // still gets chosen, while adding nothing at all to the prompt.
    const parsed = createStylePresetSchema.safeParse({
      ...VALID,
      positivePrompt: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a one-word visual direction", () => {
    const parsed = createStylePresetSchema.safeParse({
      ...VALID,
      positivePrompt: "nice",
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses an unknown aspect ratio rather than coercing it", () => {
    const parsed = createStylePresetSchema.safeParse({
      ...VALID,
      defaultAspectRatio: "4:3",
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a prompt beyond the length cap", () => {
    const parsed = createStylePresetSchema.safeParse({
      ...VALID,
      positivePrompt: "a".repeat(4001),
    });
    expect(parsed.success).toBe(false);
  });

  it("trims surrounding whitespace off the name", () => {
    const parsed = createStylePresetSchema.safeParse({
      ...VALID,
      name: "  Anime cel  ",
    });
    expect(parsed.success && parsed.data.name).toBe("Anime cel");
  });
});

describe("editing a style", () => {
  it("requires the version being edited, which is the optimistic lock", () => {
    const parsed = updateStylePresetSchema.safeParse({
      ...VALID,
      stylePresetId: "8f2c4b1e-0000-4000-8000-000000000001",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a version number submitted as a form string", () => {
    const parsed = updateStylePresetSchema.safeParse({
      ...VALID,
      stylePresetId: "8f2c4b1e-0000-4000-8000-000000000001",
      expectedCurrentVersion: "3",
    });
    expect(parsed.success && parsed.data.expectedCurrentVersion).toBe(3);
  });

  it("refuses a version of zero, which no row can have", () => {
    const parsed = updateStylePresetSchema.safeParse({
      ...VALID,
      stylePresetId: "8f2c4b1e-0000-4000-8000-000000000001",
      expectedCurrentVersion: "0",
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a style id that is not a uuid", () => {
    const parsed = updateStylePresetSchema.safeParse({
      ...VALID,
      stylePresetId: "../../etc/passwd",
      expectedCurrentVersion: "1",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("adding from a template", () => {
  it("accepts a plain key", () => {
    const parsed = addStylePresetFromTemplateSchema.safeParse({
      templateKey: "cinematic-photoreal",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses anything but lowercase letters, digits and hyphens", () => {
    for (const templateKey of [
      "../secrets",
      "Cinematic Photoreal",
      "key_with_underscore",
      "",
    ])
      expect(
        addStylePresetFromTemplateSchema.safeParse({ templateKey }).success,
      ).toBe(false);
  });
});
