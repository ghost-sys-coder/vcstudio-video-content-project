import { describe, expect, it } from "vitest";
import {
  STYLE_PRESET_TEMPLATES,
  findStylePresetTemplate,
} from "@/lib/domain/style-preset-templates";

describe("the shape of every template", () => {
  it("gives each one a distinct key", () => {
    const keys = STYLE_PRESET_TEMPLATES.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("leaves no field blank, since a blank prompt layer silently weakens every image", () => {
    for (const entry of STYLE_PRESET_TEMPLATES) {
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.description.trim().length).toBeGreaterThan(0);
      expect(entry.positivePrompt.trim().length).toBeGreaterThan(0);
      expect(entry.negativePrompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("excludes rendered text everywhere, because captions are added at render time", () => {
    for (const entry of STYLE_PRESET_TEMPLATES)
      expect(entry.negativePrompt).toContain("captions");
  });

  it("excludes watermarks everywhere, because one baked into a still cannot be removed later", () => {
    for (const entry of STYLE_PRESET_TEMPLATES)
      expect(entry.negativePrompt).toContain("watermarks");
  });
});

describe("templates that aim at real people", () => {
  it("offers at least one, which is the gap the seeded default left", () => {
    const realistic = STYLE_PRESET_TEMPLATES.filter(
      (entry) => entry.suitsRealisticPeople,
    );
    expect(realistic.length).toBeGreaterThan(0);
  });

  it("never forbids the very thing it claims to produce", () => {
    // The seeded default's negative prompt bans photorealism outright. A
    // template claiming to suit real people while carrying that ban would be
    // silently unusable, and the failure would look like a model problem.
    for (const entry of STYLE_PRESET_TEMPLATES) {
      if (!entry.suitsRealisticPeople) continue;
      expect(entry.negativePrompt).not.toContain("photorealism");
      expect(entry.negativePrompt).not.toContain("photorealistic");
    }
  });

  it("keeps the drawn templates honest in the other direction", () => {
    for (const entry of STYLE_PRESET_TEMPLATES) {
      if (entry.suitsRealisticPeople) continue;
      expect(entry.negativePrompt).toContain("photorealism");
    }
  });
});

describe("looking a template up", () => {
  it("finds one by key", () => {
    expect(findStylePresetTemplate("cinematic-photoreal")?.name).toBe(
      "Cinematic photoreal",
    );
  });

  it("returns null for an unknown key rather than guessing a nearby one", () => {
    expect(findStylePresetTemplate("no-such-template")).toBeNull();
  });
});
