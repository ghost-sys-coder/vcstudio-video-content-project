import "server-only";

import { findSceneAnalysisRun } from "@/db/repositories/scenes.repository";
import { createSceneAnalysisRetryIdempotencyKey } from "@/lib/domain/idempotency";

export async function resolveSceneAnalysisIdempotency(input: {
  workspaceId: string;
  projectId: string;
  initialIdempotencyKey: string;
  secret: string;
}): Promise<
  { action: "create"; idempotencyKey: string } | { action: "reuse" }
> {
  let idempotencyKey = input.initialIdempotencyKey;
  for (let depth = 0; depth < 20; depth += 1) {
    const existing = await findSceneAnalysisRun({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      idempotencyKey,
    });
    if (!existing) return { action: "create", idempotencyKey };
    if (existing.status !== "failed") return { action: "reuse" };
    idempotencyKey = createSceneAnalysisRetryIdempotencyKey({
      secret: input.secret,
      failedRunId: existing.id,
    });
  }
  throw new Error("SCENE_ANALYSIS_RETRY_LIMIT");
}
