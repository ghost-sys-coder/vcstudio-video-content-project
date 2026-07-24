import { describe, expect, it } from "vitest";
import {
  inviteWorkspaceMemberSchema,
  updateWorkspaceProfileSchema,
} from "@/lib/schemas/workspace";

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

describe("invite workspace member validation", () => {
  it("accepts a valid email and role, lowercasing the email", () => {
    const result = inviteWorkspaceMemberSchema.safeParse({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      email: "Teammate@Example.com",
      role: "editor",
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("teammate@example.com");
  });

  it("rejects an invalid email or role", () => {
    expect(
      inviteWorkspaceMemberSchema.safeParse({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        email: "not-an-email",
        role: "editor",
      }).success,
    ).toBe(false);
    expect(
      inviteWorkspaceMemberSchema.safeParse({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        email: "teammate@example.com",
        role: "admin",
      }).success,
    ).toBe(false);
  });
});
