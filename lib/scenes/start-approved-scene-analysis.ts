import "server-only";

import type { Project } from "@/db/schema";
import {
  findApprovedScriptVersion,
  findLatestSceneAnalysisRun,
  findSceneAnalysisRun,
} from "@/db/repositories/scenes.repository";
import { startSceneAnalysis } from "@/lib/scenes/start-scene-analysis";

export class SceneAnalysisRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneAnalysisRequestError";
  }
}

export interface StartApprovedSceneAnalysisResult {
  analysisRunId: string | null;
  /** False when an equivalent analysis already exists and was reused. */
  created: boolean;
  estimatedCostCents: number;
}

/**
 * Starts scene analysis of the project's approved script.
 *
 * A thin lookup over {@link startSceneAnalysis}, so the scenes page and a
 * production run start exactly the same operation, with the same estimate,
 * budget checks and idempotency, from a project rather than a version row.
 */
export async function startApprovedSceneAnalysis(input: {
  workspaceId: string;
  project: Project;
  requestedByUserId: string;
  scriptVersionId?: string;
}): Promise<StartApprovedSceneAnalysisResult> {
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
  const version = await findApprovedScriptVersion({
    ...scope,
    scriptVersionId: input.scriptVersionId,
  });
  if (!version)
    throw new SceneAnalysisRequestError(
      "Approve this script version before analysis.",
    );
  const started = await startSceneAnalysis({
    workspaceId: input.workspaceId,
    project: input.project,
    version,
    requestedByUserId: input.requestedByUserId,
  });
  const run = started.analysisRunId
    ? await findSceneAnalysisRun({
        ...scope,
        analysisRunId: started.analysisRunId,
      })
    : await findLatestSceneAnalysisRun(scope);
  return {
    analysisRunId: run?.id ?? started.analysisRunId,
    created: started.created,
    estimatedCostCents: started.created ? (run?.estimatedCostCents ?? 0) : 0,
  };
}
