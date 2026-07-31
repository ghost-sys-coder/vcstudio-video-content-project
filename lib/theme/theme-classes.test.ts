import { describe, expect, it } from "vitest";
import {
  isValidThemePreference,
  nextTheme,
  themeClassName,
} from "@/lib/theme/theme-classes";

describe("nextTheme", () => {
  it("cycles light -> dim -> dark -> light", () => {
    expect(nextTheme("light")).toBe("dim");
    expect(nextTheme("dim")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });
});

describe("themeClassName", () => {
  it("gives light no class, matching the unmarked :root variables", () => {
    expect(themeClassName("light")).toBeNull();
  });

  it("gives dark and dim their own class", () => {
    expect(themeClassName("dark")).toBe("dark");
    expect(themeClassName("dim")).toBe("dim");
  });
});

describe("isValidThemePreference", () => {
  it("accepts the three known themes", () => {
    expect(isValidThemePreference("light")).toBe(true);
    expect(isValidThemePreference("dim")).toBe(true);
    expect(isValidThemePreference("dark")).toBe(true);
  });

  it("rejects anything else, including undefined", () => {
    expect(isValidThemePreference("system")).toBe(false);
    expect(isValidThemePreference("")).toBe(false);
    expect(isValidThemePreference(undefined)).toBe(false);
  });
});
