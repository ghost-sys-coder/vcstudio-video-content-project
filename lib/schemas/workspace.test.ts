import { describe, expect, it } from "vitest";
import { updateWorkspaceProfileSchema } from "@/lib/schemas/workspace";

describe("workspace profile validation", () => {
  it("accepts a valid workspace name and identifier", () => {
    expect(
      updateWorkspaceProfileSchema.safeParse({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "Studio North",
      }).success,
    ).toBe(true);
  });

  it("rejects empty and oversized workspace names", () => {
    expect(
      updateWorkspaceProfileSchema.safeParse({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: " ",
      }).success,
    ).toBe(false);
    expect(
      updateWorkspaceProfileSchema.safeParse({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "x".repeat(81),
      }).success,
    ).toBe(false);
  });
});
