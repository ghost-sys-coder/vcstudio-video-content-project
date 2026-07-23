import "server-only";

import { saveProjectBrief } from "@/db/commands/project-brief.command";
import { findContentIdea } from "@/db/repositories/content-ideas.repository";
import { findProject } from "@/db/repositories/projects.repository";

export class ApplyIdeaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyIdeaError";
  }
}

/**
 * Copy a saved idea's fields into a project's brief. Both the project and the
 * idea are resolved workspace-scoped first, so a browser cannot apply another
 * tenant's idea or write to another tenant's project — the cross-workspace guard
 * for the autofill hop. Overwrites the current brief on purpose: the user chose
 * this idea as the project's starting point.
 */
export async function applyIdeaToBrief(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  ideaId: string;
}): Promise<{ topic: string }> {
  const [project, idea] = await Promise.all([
    findProject({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    }),
    findContentIdea({ workspaceId: input.workspaceId, ideaId: input.ideaId }),
  ]);
  if (!project) throw new ApplyIdeaError("Project not found.");
  if (!idea) throw new ApplyIdeaError("That idea is no longer available.");

  await saveProjectBrief({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    topic: idea.topic,
    targetAudience: idea.targetAudience,
    tone: idea.tone,
    targetDurationSeconds: idea.targetDurationSeconds,
    primaryPlatform: idea.primaryPlatform,
    hookAngle: idea.hookAngle,
    niche: idea.niche,
    userId: input.userId,
  });
  return { topic: idea.topic };
}
