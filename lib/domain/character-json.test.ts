import { describe, expect, it } from "vitest";
import {
  characterJsonSample,
  parseCharacterJson,
} from "@/lib/domain/character-json";

describe("character JSON", () => {
  it("parses the supplied sample", () => {
    expect(parseCharacterJson(JSON.stringify(characterJsonSample))).toEqual({
      success: true,
      data: characterJsonSample,
    });
  });

  it("returns an actionable malformed JSON error", () => {
    expect(parseCharacterJson("{ invalid")).toEqual({
      success: false,
      error: "Enter valid JSON before loading it.",
    });
  });

  it("reports the invalid field path", () => {
    const result = parseCharacterJson(
      JSON.stringify({ ...characterJsonSample, status: "archived" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("status:");
  });

  it("rejects misspelled or unsupported properties", () => {
    const result = parseCharacterJson(
      JSON.stringify({ ...characterJsonSample, eyeColour: "brown" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Unrecognized key");
  });
});
