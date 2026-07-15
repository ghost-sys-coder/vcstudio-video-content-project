import type { WorkspaceRole } from "@/db/schema";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";

const workspaceCapabilities = {
  owner: {
    editWorkspace: true,
    manageMembers: true,
    manageSettings: true,
    mutateWorkspaceData: true,
  },
  editor: {
    editWorkspace: true,
    manageMembers: false,
    manageSettings: false,
    mutateWorkspaceData: true,
  },
  viewer: {
    editWorkspace: false,
    manageMembers: false,
    manageSettings: false,
    mutateWorkspaceData: false,
  },
} as const satisfies Record<WorkspaceRole, Record<string, boolean>>;

export type WorkspaceCapability = keyof (typeof workspaceCapabilities)["owner"];

export function can(
  role: WorkspaceRole,
  capability: WorkspaceCapability,
): boolean {
  return workspaceCapabilities[role][capability];
}

export function requireCapability(
  role: WorkspaceRole,
  capability: WorkspaceCapability,
): void {
  if (!can(role, capability)) {
    throw new WorkspacePermissionDeniedError();
  }
}

export const canCreateProject = (role: WorkspaceRole) =>
  can(role, "mutateWorkspaceData");
export const canEditProject = canCreateProject;
export const canGenerateAssets = canCreateProject;
export const canRenderProject = canCreateProject;
export const canManageWorkspace = (role: WorkspaceRole) =>
  can(role, "manageSettings");
