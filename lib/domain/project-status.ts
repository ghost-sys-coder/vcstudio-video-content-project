import type { ProjectStatus } from "@/db/schema";

const transitions: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ["planning", "archived"],
  planning: ["draft", "assetGeneration", "failed", "archived"],
  assetGeneration: ["review", "failed", "archived"],
  review: ["assetGeneration", "readyToRender", "failed", "archived"],
  readyToRender: ["review", "rendering", "archived"],
  rendering: ["completed", "failed"],
  completed: ["archived"],
  failed: ["draft", "planning", "archived"],
  archived: [],
};

export function canTransitionProjectStatus(
  from: ProjectStatus,
  to: ProjectStatus,
) {
  return from === to || transitions[from].includes(to);
}

export function getProjectStatusTransitions(status: ProjectStatus) {
  return transitions[status];
}
