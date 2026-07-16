import { describe, expect, it } from "vitest";
import {
  areReferenceDimensionsAllowed,
  createCharacterSlug,
  isCharacterMutable,
  singleCharacterReferenceTypes,
} from "@/lib/domain/character";

describe("character domain", () => {
  it("creates stable workspace-scoped slug candidates", () => {
    expect(createCharacterSlug("  Amélie Stone  ")).toBe("amelie-stone");
  });

  it("prevents archived character mutation", () => {
    expect(isCharacterMutable("active")).toBe(true);
    expect(isCharacterMutable("archived")).toBe(false);
  });

  it("defines single-cardinality identity views", () => {
    expect(singleCharacterReferenceTypes.has("master")).toBe(true);
    expect(singleCharacterReferenceTypes.has("expression")).toBe(false);
  });

  it("validates configured image dimension boundaries", () => {
    const limits = {
      minimumWidth: 512,
      minimumHeight: 512,
      maximumWidth: 4096,
      maximumHeight: 4096,
    };
    expect(
      areReferenceDimensionsAllowed({ width: 512, height: 4096, ...limits }),
    ).toBe(true);
    expect(
      areReferenceDimensionsAllowed({ width: 511, height: 1024, ...limits }),
    ).toBe(false);
  });
});
