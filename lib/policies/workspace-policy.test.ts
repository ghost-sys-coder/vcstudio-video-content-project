import { describe, expect, it } from "vitest";
import {
  can,
  canCreateProject,
  canEditProject,
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
    expect(canCreateProject("viewer")).toBe(false);
    expect(can("viewer", "deleteScriptVersions")).toBe(false);
  });

  it("allows editors to mutate workspace data but not manage membership", () => {
    expect(can("editor", "mutateWorkspaceData")).toBe(true);
    expect(can("editor", "manageMembers")).toBe(false);
    expect(canManageWorkspace("editor")).toBe(false);
    expect(canEditProject("editor")).toBe(true);
    expect(can("editor", "deleteScriptVersions")).toBe(true);
  });

  it("allows owners to manage membership and workspace settings", () => {
    expect(can("owner", "manageMembers")).toBe(true);
    expect(canManageWorkspace("owner")).toBe(true);
    expect(can("owner", "deleteScriptVersions")).toBe(true);
  });
});
