import "server-only";

import { renderIdeaGenerationPrompt } from "@studio/prompts";
import type { ContentIdea, ContentPlatform } from "@/db/schema";
import { listContentIdeas } from "@/db/repositories/content-ideas.repository";
import { estimateIdeaGenerationCost } from "@/lib/costs/idea-generation-cost";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { DEFAULT_IDEAS } from "@/lib/schemas/idea-generation";

export type SavedIdeaView = {
  id: string;
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
  createdAtLabel: string;
};

export type IdeaNicheGroup = {
  niche: string;
  ideas: SavedIdeaView[];
};

export type IdeaLabView = {
  groups: IdeaNicheGroup[];
  totalCount: number;
  model: string;
  estimatedCostCents: number;
  defaultCount: number;
  maxPerBatch: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function toSavedIdeaView(idea: ContentIdea): SavedIdeaView {
  return {
    id: idea.id,
    niche: idea.niche,
    topic: idea.topic,
    targetAudience: idea.targetAudience,
    tone: idea.tone,
    targetDurationSeconds: idea.targetDurationSeconds,
    primaryPlatform: idea.primaryPlatform,
    hookAngle: idea.hookAngle,
    rationale: idea.rationale,
    hookType: idea.hookType,
    source: idea.source,
    createdAtLabel: dateFormatter.format(idea.createdAt),
  };
}

/**
 * Group saved ideas by niche. Input is already newest-first, so first-seen
 * insertion keeps both the groups and the ideas within each group in recency
 * order.
 */
export function groupIdeasByNiche(
  ideas: readonly SavedIdeaView[],
): IdeaNicheGroup[] {
  const groups = new Map<string, SavedIdeaView[]>();
  for (const idea of ideas) {
    const bucket = groups.get(idea.niche);
    if (bucket) bucket.push(idea);
    else groups.set(idea.niche, [idea]);
  }
  return [...groups.entries()].map(([niche, groupIdeas]) => ({
    niche,
    ideas: groupIdeas,
  }));
}

/**
 * Saved ideas grouped by niche for the script-screen brief picker. Lighter than
 * {@link loadIdeaLabView} — no cost estimate, just the options.
 */
export async function loadIdeaPickerGroups(input: {
  workspaceId: string;
}): Promise<IdeaNicheGroup[]> {
  const ideas = await listContentIdeas({ workspaceId: input.workspaceId });
  return groupIdeasByNiche(ideas.map(toSavedIdeaView));
}

export async function loadIdeaLabView(input: {
  workspaceId: string;
}): Promise<IdeaLabView> {
  const ideas = await listContentIdeas({ workspaceId: input.workspaceId });
  const environment = getSceneAnalysisEnvironment();
  const samplePrompt = renderIdeaGenerationPrompt({
    niche: "your niche",
    count: DEFAULT_IDEAS,
    platform: null,
    tonePreference: null,
    language: "English",
  });
  const estimate = estimateIdeaGenerationCost({
    prompt: samplePrompt,
    count: DEFAULT_IDEAS,
    inputCostPerMillionCents:
      environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
    outputCostPerMillionCents:
      environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
  });
  return {
    groups: groupIdeasByNiche(ideas.map(toSavedIdeaView)),
    totalCount: ideas.length,
    model: environment.OPENAI_TEXT_MODEL,
    estimatedCostCents: estimate.estimatedCostCents,
    defaultCount: DEFAULT_IDEAS,
    maxPerBatch: environment.MAX_IDEAS_PER_BATCH,
  };
}
