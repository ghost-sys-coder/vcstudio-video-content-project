import { describe, expect, it } from "vitest";
import {
  matchCharacterNamesToCast,
  normalizeCharacterName,
} from "@/lib/scenes/character-name-matching";

const cast = [
  { id: "kane", name: "Detective Kane" },
  { id: "diaz", name: "Officer Diaz" },
  { id: "narrator", name: "Narrator" },
];

describe("normalizeCharacterName", () => {
  it("strips a leading article and lowercases", () => {
    expect(normalizeCharacterName("The Detective")).toBe(
      normalizeCharacterName("detective"),
    );
    expect(normalizeCharacterName("An Officer")).toBe(
      normalizeCharacterName("Officer"),
    );
  });

  it("collapses simple plurals to the singular form", () => {
    expect(normalizeCharacterName("Detectives")).toBe(
      normalizeCharacterName("Detective"),
    );
    expect(normalizeCharacterName("Officers")).toBe(
      normalizeCharacterName("Officer"),
    );
  });

  it("leaves double-s endings intact", () => {
    expect(normalizeCharacterName("Boss")).toBe("boss");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeCharacterName("   ")).toBe("");
    expect(normalizeCharacterName("")).toBe("");
  });
});

describe("matchCharacterNamesToCast", () => {
  it("matches names case-insensitively and through articles", () => {
    expect(
      matchCharacterNamesToCast(["the detective kane", "NARRATOR"], cast),
    ).toEqual(["kane", "narrator"]);
  });

  it("returns cast-ordered, de-duplicated ids", () => {
    expect(
      matchCharacterNamesToCast(
        ["Narrator", "Detective Kane", "Detective Kane"],
        cast,
      ),
    ).toEqual(["kane", "narrator"]);
  });

  it("ignores names with no cast match", () => {
    expect(
      matchCharacterNamesToCast(["A stranger", "the crowd"], cast),
    ).toEqual([]);
  });

  it("returns nothing for an empty cast or empty names", () => {
    expect(matchCharacterNamesToCast(["Detective Kane"], [])).toEqual([]);
    expect(matchCharacterNamesToCast([], cast)).toEqual([]);
  });
});
