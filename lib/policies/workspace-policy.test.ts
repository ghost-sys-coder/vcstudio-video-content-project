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
    expect(can("viewer", "manageCharacters")).toBe(false);
    expect(can("viewer", "generateSceneImages")).toBe(false);
    expect(can("viewer", "reviewSceneImages")).toBe(false);
  });

  it("allows editors to mutate workspace data but not manage membership", () => {
    expect(can("editor", "mutateWorkspaceData")).toBe(true);
    expect(can("editor", "manageMembers")).toBe(false);
    expect(canManageWorkspace("editor")).toBe(false);
    expect(canEditProject("editor")).toBe(true);
    expect(can("editor", "deleteScriptVersions")).toBe(true);
    expect(can("editor", "manageCharacters")).toBe(true);
    expect(can("editor", "generateSceneImages")).toBe(true);
    expect(can("editor", "reviewSceneImages")).toBe(true);
  });

  it("allows owners to manage membership and workspace settings", () => {
    expect(can("owner", "manageMembers")).toBe(true);
    expect(canManageWorkspace("owner")).toBe(true);
    expect(can("owner", "deleteScriptVersions")).toBe(true);
    expect(can("owner", "manageCharacters")).toBe(true);
    expect(can("owner", "generateSceneImages")).toBe(true);
    expect(can("owner", "reviewSceneImages")).toBe(true);
  });

  it("gates video rendering to owners and editors only", () => {
    expect(can("owner", "renderVideo")).toBe(true);
    expect(can("editor", "renderVideo")).toBe(true);
    expect(can("viewer", "renderVideo")).toBe(false);
    expect(() => requireCapability("viewer", "renderVideo")).toThrow(
      WorkspacePermissionDeniedError,
    );
  });

  it("gates usage administration to owners and editors only", () => {
    expect(can("owner", "manageUsage")).toBe(true);
    expect(can("editor", "manageUsage")).toBe(true);
    expect(can("viewer", "manageUsage")).toBe(false);
    expect(() => requireCapability("viewer", "manageUsage")).toThrow(
      WorkspacePermissionDeniedError,
    );
  });
});
