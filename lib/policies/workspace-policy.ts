import type { WorkspaceRole } from "@/db/schema";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";

const workspaceCapabilities = {
  owner: {
    editWorkspace: true,
    manageMembers: true,
    manageSettings: true,
    mutateWorkspaceData: true,
    approveScripts: true,
    analyzeScenes: true,
    editScenes: true,
    approveScenes: true,
    deleteScriptVersions: true,
    manageCharacters: true,
    generateSceneImages: true,
    reviewSceneImages: true,
    generateSceneAudio: true,
    reviewSceneAudio: true,
    manageVoicePresets: true,
    manageSubtitles: true,
    renderVideo: true,
  },
  editor: {
    editWorkspace: true,
    manageMembers: false,
    manageSettings: false,
    mutateWorkspaceData: true,
    approveScripts: true,
    analyzeScenes: true,
    editScenes: true,
    approveScenes: true,
    deleteScriptVersions: true,
    manageCharacters: true,
    generateSceneImages: true,
    reviewSceneImages: true,
    generateSceneAudio: true,
    reviewSceneAudio: true,
    manageVoicePresets: true,
    manageSubtitles: true,
    renderVideo: true,
  },
  viewer: {
    editWorkspace: false,
    manageMembers: false,
    manageSettings: false,
    mutateWorkspaceData: false,
    approveScripts: false,
    analyzeScenes: false,
    editScenes: false,
    approveScenes: false,
    deleteScriptVersions: false,
    manageCharacters: false,
    generateSceneImages: false,
    reviewSceneImages: false,
    generateSceneAudio: false,
    reviewSceneAudio: false,
    manageVoicePresets: false,
    manageSubtitles: false,
    renderVideo: false,
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
