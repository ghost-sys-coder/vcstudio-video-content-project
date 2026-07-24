import { describe, expect, it } from "vitest";
import { updateThemePreferenceSchema } from "@/lib/schemas/user";

describe("theme preference validation", () => {
  it("accepts light and dark", () => {
    expect(
      updateThemePreferenceSchema.safeParse({ theme: "light" }).success,
    ).toBe(true);
    expect(
      updateThemePreferenceSchema.safeParse({ theme: "dark" }).success,
    ).toBe(true);
  });

  it("rejects any other value", () => {
    expect(
      updateThemePreferenceSchema.safeParse({ theme: "system" }).success,
    ).toBe(false);
    expect(updateThemePreferenceSchema.safeParse({ theme: "" }).success).toBe(
      false,
    );
    expect(updateThemePreferenceSchema.safeParse({}).success).toBe(false);
  });
});
