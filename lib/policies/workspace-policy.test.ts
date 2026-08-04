import { describe, expect, it } from "vitest";
import {
  can,
  canCreateProject,
  canDeleteProject,
  canEditProject,
  canManageMembers,
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
    expect(canManageMembers("editor")).toBe(false);
    expect(canManageWorkspace("editor")).toBe(false);
    expect(canEditProject("editor")).toBe(true);
    expect(can("editor", "deleteScriptVersions")).toBe(true);
    expect(can("editor", "manageCharacters")).toBe(true);
    expect(can("editor", "generateSceneImages")).toBe(true);
    expect(can("editor", "reviewSceneImages")).toBe(true);
  });

  it("allows owners to manage membership and workspace settings", () => {
    expect(can("owner", "manageMembers")).toBe(true);
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageWorkspace("owner")).toBe(true);
    expect(canManageMembers("viewer")).toBe(false);
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

  it("gates permanent project deletion to owners only", () => {
    // Stricter than every other destructive capability, including
    // deleteScriptVersions: deletion erases stored assets and publish history
    // with no archive or restore path back.
    expect(can("owner", "deleteProjects")).toBe(true);
    expect(can("editor", "deleteProjects")).toBe(false);
    expect(can("viewer", "deleteProjects")).toBe(false);
    expect(canDeleteProject("owner")).toBe(true);
    expect(canDeleteProject("editor")).toBe(false);
    for (const role of ["editor", "viewer"] as const)
      expect(() => requireCapability(role, "deleteProjects")).toThrow(
        WorkspacePermissionDeniedError,
      );
  });

  it("still lets editors edit the projects they cannot delete", () => {
    expect(canEditProject("editor")).toBe(true);
    expect(canDeleteProject("editor")).toBe(false);
  });

  it("gates day-to-day marketing work to owners and editors", () => {
    for (const capability of [
      "useMarketingChat",
      "manageBrandProfile",
      "approveMarketingContent",
      "runMarketingResearch",
    ] as const) {
      expect(can("owner", capability)).toBe(true);
      expect(can("editor", capability)).toBe(true);
      expect(can("viewer", capability)).toBe(false);
    }
  });

  it("gates unattended spending to owners only", () => {
    // Both let somebody who is not present cause spending: a schedule rule
    // generates on a timer, and a user-authored skill is prompt text that a
    // later run executes.
    for (const capability of [
      "manageMarketingSchedules",
      "manageMarketingSkills",
    ] as const) {
      expect(can("owner", capability)).toBe(true);
      expect(can("editor", capability)).toBe(false);
      expect(can("viewer", capability)).toBe(false);
      for (const role of ["editor", "viewer"] as const)
        expect(() => requireCapability(role, capability)).toThrow(
          WorkspacePermissionDeniedError,
        );
    }
  });
});
