import { describe, expect, it } from "vitest";
import {
  isValidThemePreference,
  nextTheme,
  normalizeThemePreference,
  themeClassName,
} from "@/lib/theme/theme-classes";

describe("nextTheme", () => {
  it("cycles between light and dark", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });
});

describe("themeClassName", () => {
  it("gives light no class, matching the unmarked :root variables", () => {
    expect(themeClassName("light")).toBeNull();
  });

  it("gives dark its own class", () => {
    expect(themeClassName("dark")).toBe("dark");
  });
});

describe("isValidThemePreference", () => {
  it("accepts light and dark", () => {
    expect(isValidThemePreference("light")).toBe(true);
    expect(isValidThemePreference("dark")).toBe(true);
  });

  it("rejects anything else, including undefined", () => {
    expect(isValidThemePreference("dim")).toBe(false);
    expect(isValidThemePreference("system")).toBe(false);
    expect(isValidThemePreference("")).toBe(false);
    expect(isValidThemePreference(undefined)).toBe(false);
  });
});

describe("normalizeThemePreference", () => {
  it("keeps supported preferences", () => {
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("dark")).toBe("dark");
  });

  it("maps legacy Dim cookies and stored preferences to Dark", () => {
    expect(normalizeThemePreference("dim")).toBe("dark");
  });

  it.each([undefined, null, "", "system", 42])(
    "defaults invalid or missing preference %s to Light",
    (value) => {
      expect(normalizeThemePreference(value)).toBe("light");
    },
  );
});
