"use server";

import { revalidatePath } from "next/cache";
import {
  archiveContentIdea,
  saveContentIdea,
} from "@/db/commands/idea-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import {
  generateIdeas,
  IdeaGenerationRequestError,
} from "@/lib/ideas/generate-ideas";
import { toSavedIdeaView, type SavedIdeaView } from "@/lib/ideas/ideas-view";
import { RateLimitExceededError } from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  archiveIdeaSchema,
  generateIdeasSchema,
  saveIdeaSchema,
  type GeneratedIdea,
} from "@/lib/schemas/idea-generation";

export type GenerateIdeasResult =
  | { ok: true; runId: string; niche: string; ideas: GeneratedIdea[] }
  | { ok: false; error: string };

export type SaveIdeaResult =
  { ok: true; idea: SavedIdeaView } | { ok: false; error: string };

export type ArchiveIdeaResult = { ok: true } | { ok: false; error: string };

function optionalField(value: FormDataEntryValue | null): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? undefined : trimmed;
}

export async function generateIdeasAction(
  formData: FormData,
): Promise<GenerateIdeasResult> {
  const parsed = generateIdeasSchema.safeParse({
    niche: formData.get("niche"),
    platform: optionalField(formData.get("platform")),
    tonePreference: optionalField(formData.get("tonePreference")),
    count: formData.get("count") ?? undefined,
    requestNonce: formData.get("requestNonce"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a niche to continue.",
    };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "mutateWorkspaceData");

    const environment = getSceneAnalysisEnvironment();
    const count = Math.min(parsed.data.count, environment.MAX_IDEAS_PER_BATCH);
    const { runId, ideas } = await generateIdeas({
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
      niche: parsed.data.niche,
      platform: parsed.data.platform ?? null,
      tonePreference: parsed.data.tonePreference ?? null,
      language: "English",
      count,
    });
    return { ok: true, runId, niche: parsed.data.niche, ideas };
  } catch (error) {
    if (error instanceof IdeaGenerationRequestError)
      return { ok: false, error: error.message };
    if (error instanceof RateLimitExceededError)
      return {
        ok: false,
        error: "You're generating ideas too quickly. Please wait a moment.",
      };
    return {
      ok: false,
      error: "Ideas could not be generated. Please try again.",
    };
  }
}

export async function saveIdeaAction(
  formData: FormData,
): Promise<SaveIdeaResult> {
  const parsed = saveIdeaSchema.safeParse({
    niche: formData.get("niche"),
    topic: formData.get("topic") ?? undefined,
    targetAudience: formData.get("targetAudience") ?? undefined,
    tone: formData.get("tone") ?? undefined,
    targetDurationSeconds: optionalField(formData.get("targetDurationSeconds")),
    primaryPlatform: formData.get("primaryPlatform"),
    hookAngle: formData.get("hookAngle") ?? undefined,
    rationale: formData.get("rationale") ?? undefined,
    hookType: formData.get("hookType") ?? undefined,
    generationRunId: optionalField(formData.get("generationRunId")),
  });
  if (!parsed.success)
    return { ok: false, error: "That idea could not be saved." };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "mutateWorkspaceData");

    const idea = await saveContentIdea({
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
      generationRunId: parsed.data.generationRunId ?? null,
      niche: parsed.data.niche,
      topic: parsed.data.topic,
      targetAudience: parsed.data.targetAudience,
      tone: parsed.data.tone,
      targetDurationSeconds: parsed.data.targetDurationSeconds ?? null,
      primaryPlatform: parsed.data.primaryPlatform,
      hookAngle: parsed.data.hookAngle,
      rationale: parsed.data.rationale,
      hookType: parsed.data.hookType,
      source: "ai",
    });
    revalidatePath("/app/ideas");
    return { ok: true, idea: toSavedIdeaView(idea) };
  } catch {
    return { ok: false, error: "That idea could not be saved." };
  }
}

export async function archiveIdeaAction(
  formData: FormData,
): Promise<ArchiveIdeaResult> {
  const parsed = archiveIdeaSchema.safeParse({
    ideaId: formData.get("ideaId"),
  });
  if (!parsed.success)
    return { ok: false, error: "That idea could not be removed." };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "mutateWorkspaceData");

    const result = await archiveContentIdea({
      workspaceId: context.activeMembership.workspaceId,
      ideaId: parsed.data.ideaId,
    });
    if (!result.updated)
      return { ok: false, error: "That idea was not found." };
    revalidatePath("/app/ideas");
    return { ok: true };
  } catch {
    return { ok: false, error: "That idea could not be removed." };
  }
}
