import { describe, expect, it } from "vitest";
import {
  createWorkspaceLogoObjectKey,
  isWorkspaceLogoObjectKey,
} from "@/lib/storage/object-key";

const workspaceId = "00000000-0000-4000-8000-000000000001";

describe("workspace logo object keys", () => {
  it("creates a workspace-scoped branding key", () => {
    expect(
      createWorkspaceLogoObjectKey({ workspaceId, contentType: "image/webp" }),
    ).toMatch(
      /^workspaces\/00000000-0000-4000-8000-000000000001\/branding\/logos\/[0-9a-f-]+\.webp$/,
    );
  });

  it("rejects cross-workspace and traversal keys", () => {
    expect(
      isWorkspaceLogoObjectKey({
        workspaceId,
        objectKey:
          "workspaces/00000000-0000-4000-8000-000000000002/branding/logos/logo.png",
      }),
    ).toBe(false);
    expect(
      isWorkspaceLogoObjectKey({
        workspaceId,
        objectKey: `workspaces/${workspaceId}/branding/logos/../secret.png`,
      }),
    ).toBe(false);
  });
});
