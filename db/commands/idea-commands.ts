import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  contentIdeaGenerationRuns,
  contentIdeas,
  type ContentIdea,
  type ContentPlatform,
} from "@/db/schema";

/**
 * Record a completed idea-generation run. This is the off-ledger spend record
 * (see `content_idea_generation_runs` in the schema): idea generation is a
 * sub-cent one-shot text call, so instead of a `usage_reservations` row we write
 * the actual cost here for visibility. Returns the run id so saved ideas can
 * reference their provenance.
 */
export async function recordIdeaGenerationRun(input: {
  workspaceId: string;
  userId: string;
  niche: string;
  platform: ContentPlatform | null;
  tonePreference: string | null;
  language: string;
  requestedCount: number;
  resultCount: number;
  model: string;
  promptVersion: string;
  finalPrompt: string;
  inputTokens: number;
  outputTokens: number;
  actualCostCents: number;
  providerRequestId: string;
}): Promise<{ id: string }> {
  const [run] = await getDatabase()
    .insert(contentIdeaGenerationRuns)
    .values({
      workspaceId: input.workspaceId,
      requestedByUserId: input.userId,
      niche: input.niche,
      platform: input.platform,
      tonePreference: input.tonePreference,
      language: input.language,
      requestedCount: input.requestedCount,
      resultCount: input.resultCount,
      model: input.model,
      promptVersion: input.promptVersion,
      finalPrompt: input.finalPrompt,
      status: "completed",
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      actualCostCents: input.actualCostCents,
      providerRequestId: input.providerRequestId,
    })
    .returning({ id: contentIdeaGenerationRuns.id });
  return run;
}

/**
 * Record a failed idea-generation attempt with a safe error summary. Cost is
 * left null when the provider call never produced billable tokens.
 */
export async function recordFailedIdeaGenerationRun(input: {
  workspaceId: string;
  userId: string;
  niche: string;
  platform: ContentPlatform | null;
  tonePreference: string | null;
  language: string;
  requestedCount: number;
  model: string;
  promptVersion: string;
  finalPrompt: string;
  category: string;
  message: string;
}): Promise<{ id: string }> {
  const [run] = await getDatabase()
    .insert(contentIdeaGenerationRuns)
    .values({
      workspaceId: input.workspaceId,
      requestedByUserId: input.userId,
      niche: input.niche,
      platform: input.platform,
      tonePreference: input.tonePreference,
      language: input.language,
      requestedCount: input.requestedCount,
      model: input.model,
      promptVersion: input.promptVersion,
      finalPrompt: input.finalPrompt,
      status: "failed",
      errorCategory: input.category,
      safeErrorMessage: input.message,
    })
    .returning({ id: contentIdeaGenerationRuns.id });
  return run;
}

/**
 * Persist a single idea the user chose to keep. `generationRunId` is null for
 * manually authored ideas.
 */
export async function saveContentIdea(input: {
  workspaceId: string;
  userId: string;
  generationRunId: string | null;
  niche: string;
  topic: string;
  targetAudience: string;
  tone: string;
  targetDurationSeconds: number | null;
  primaryPlatform: ContentPlatform;
  hookAngle: string;
  rationale: string;
  hookType: string;
  source: "ai" | "manual";
}): Promise<ContentIdea> {
  const [idea] = await getDatabase()
    .insert(contentIdeas)
    .values({
      workspaceId: input.workspaceId,
      createdByUserId: input.userId,
      generationRunId: input.generationRunId,
      niche: input.niche,
      topic: input.topic,
      targetAudience: input.targetAudience,
      tone: input.tone,
      targetDurationSeconds: input.targetDurationSeconds,
      primaryPlatform: input.primaryPlatform,
      hookAngle: input.hookAngle,
      rationale: input.rationale,
      hookType: input.hookType,
      source: input.source,
    })
    .returning();
  return idea;
}

/**
 * Soft-archive an idea. Workspace scoped so a browser cannot archive across
 * tenants; returns whether a row matched.
 */
export async function archiveContentIdea(input: {
  workspaceId: string;
  ideaId: string;
}): Promise<{ updated: boolean }> {
  const result = await getDatabase()
    .update(contentIdeas)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(
      and(
        eq(contentIdeas.id, input.ideaId),
        eq(contentIdeas.workspaceId, input.workspaceId),
      ),
    )
    .returning({ id: contentIdeas.id });
  return { updated: result.length === 1 };
}
