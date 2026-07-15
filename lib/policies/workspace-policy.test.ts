import { describe, expect, it } from "vitest";
import {
  can,
  canManageWorkspace,
  requireCapability,
} from "@/lib/policies/workspace-policy";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";

describe("workspace policy", () => {
  it("prevents viewers from mutating workspace data", () => {
    expect(can("viewer", "mutateWorkspaceData")).toBe(false);
    expect(() => requireCapability("viewer", "mutateWorkspaceData")).toThrow(
      WorkspacePermissionDeniedError,
    );
  });

  it("allows editors to mutate workspace data but not manage membership", () => {
    expect(can("editor", "mutateWorkspaceData")).toBe(true);
    expect(can("editor", "manageMembers")).toBe(false);
  });

  it("allows owners to manage membership and workspace settings", () => {
    expect(can("owner", "manageMembers")).toBe(true);
    expect(canManageWorkspace("owner")).toBe(true);
  });
});
