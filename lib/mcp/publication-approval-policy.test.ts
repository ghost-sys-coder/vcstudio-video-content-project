import { describe, expect, it } from "vitest";
import { mcpGrantInput } from "@studio/contracts";
import {
  assertPublicationApprovalGrant,
  effectivePublicationApprovalMode,
} from "./publication-approval-policy";
import { mcpIds } from "@/lib/test-utils/mcp-fixtures";

describe("owner-controlled autonomous publishing", () => {
  it("defaults old and missing grants to manual", () => {
    expect(
      mcpGrantInput.parse({
        connectionId: mcpIds.connection,
        workspaceId: mcpIds.workspace,
        scopes: [],
      }).publicationApprovalMode,
    ).toBe("manual");
    expect(effectivePublicationApprovalMode({ role: "owner" })).toBe("manual");
  });
  it("requires owner status and an explicit Publish grant to enable autonomy", () => {
    expect(() =>
      assertPublicationApprovalGrant({
        role: "owner",
        publicationApprovalMode: "autonomous",
        scopes: ["vcstudio:publish"],
      }),
    ).not.toThrow();
    for (const role of ["editor", "viewer"] as const) {
      expect(() =>
        assertPublicationApprovalGrant({
          role,
          publicationApprovalMode: "autonomous",
          scopes: ["vcstudio:publish"],
        }),
      ).toThrow("Only a workspace owner");
      expect(
        effectivePublicationApprovalMode({
          role,
          publicationApprovalMode: "autonomous",
        }),
      ).toBe("manual");
    }
    expect(() =>
      assertPublicationApprovalGrant({
        role: "owner",
        publicationApprovalMode: "autonomous",
        scopes: ["vcstudio:read"],
      }),
    ).toThrow("Publish permission");
  });
  it("does not change ordinary manual permission grants", () => {
    for (const role of ["owner", "editor", "viewer"] as const)
      expect(() =>
        assertPublicationApprovalGrant({
          role,
          publicationApprovalMode: "manual",
          scopes: ["vcstudio:read"],
        }),
      ).not.toThrow();
  });
});
