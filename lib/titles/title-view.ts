import "server-only";

import {
  renderTitleGenerationPrompt,
  TITLE_GENERATION_PROMPT_VERSION,
} from "@studio/prompts";
import type {
  ContentPlatform,
  Project,
  ProjectBrief,
  TitleGenerationRun,
} from "@/db/schema";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";
import { VIDEO_CONTENT_PLATFORMS } from "@/lib/platforms/video-content-platforms";
import { estimateTitleGenerationCost } from "@/lib/costs/title-generation-cost";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { findApprovedScriptVersion } from "@/db/repositories/scenes.repository";
import {
  findLatestTitleGenerationRunForPlatform,
  listProjectTitleSuggestions,
} from "@/db/repositories/title-generation.repository";
import { DEFAULT_TITLE_OPTIONS } from "@/lib/schemas/title-generation";

// Re-exported so the server-side callers that already import it from here keep
// working; the definition lives in a client-safe module because the composer's
// previews need it in the browser.
export { CONTENT_PLATFORM_LABELS };

export type TitleSuggestionView = {
  id: string;
  text: string;
  rationale: string;
  hookType: string;
  isFavorite: boolean;
};

export type TitleRunView = {
  id: string;
  status: TitleGenerationRun["status"];
  errorCategory: string | null;
  safeErrorMessage: string | null;
  estimatedCostCents: number;
  actualCostCents: number | null;
  createdAtLabel: string;
};

export type PlatformTitlesView = {
  platform: ContentPlatform;
  label: string;
  estimatedCostCents: number;
  latestRun: TitleRunView | null;
  suggestions: TitleSuggestionView[];
};

export type TitlesView = {
  model: string;
  optionCount: number;
  hasContext: boolean;
  promptVersion: string;
  platforms: PlatformTitlesView[];
};

export type TitleActionResult = {
  success: boolean;
  error: string | null;
};

function toRunView(run: TitleGenerationRun): TitleRunView {
  return {
    id: run.id,
    status: run.status,
    errorCategory: run.errorCategory,
    safeErrorMessage: run.safeErrorMessage,
    estimatedCostCents: run.estimatedCostCents,
    actualCostCents: run.actualCostCents,
    createdAtLabel: `${run.createdAt
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC`,
  };
}

export async function loadTitlesView(input: {
  workspaceId: string;
  project: Project;
  brief: ProjectBrief | null;
}): Promise<TitlesView> {
  const environment = getSceneAnalysisEnvironment();
  const optionCount = DEFAULT_TITLE_OPTIONS;
  const [approvedScript, allSuggestions, latestRuns] = await Promise.all([
    findApprovedScriptVersion({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
    }),
    listProjectTitleSuggestions({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
    }),
    Promise.all(
      VIDEO_CONTENT_PLATFORMS.map((platform) =>
        findLatestTitleGenerationRunForPlatform({
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          platform,
        }),
      ),
    ),
  ]);

  const hasTopic = Boolean(input.brief && input.brief.topic.trim() !== "");
  const hasContext = hasTopic || approvedScript !== null;

  const latestRunByPlatform = new Map<ContentPlatform, TitleGenerationRun>();
  for (const run of latestRuns)
    if (run) latestRunByPlatform.set(run.platform, run);

  const platforms: PlatformTitlesView[] = VIDEO_CONTENT_PLATFORMS.map(
    (platform) => {
      const prompt = renderTitleGenerationPrompt({
        platform,
        topic: input.brief?.topic ?? "",
        targetAudience: input.brief?.targetAudience ?? "",
        tone: input.brief?.tone ?? "",
        hookAngle: input.brief?.hookAngle ?? "",
        script: approvedScript?.content ?? null,
        language: input.project.language,
        optionCount,
      });
      const estimatedCostCents = estimateTitleGenerationCost({
        prompt,
        optionCount,
        inputCostPerMillionCents:
          environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
      }).estimatedCostCents;

      const platformSuggestions = allSuggestions.filter(
        (suggestion) => suggestion.platform === platform,
      );
      // `allSuggestions` is newest-first; show only the latest run's set.
      const latestRunId = platformSuggestions[0]?.titleGenerationRunId ?? null;
      const suggestions: TitleSuggestionView[] = platformSuggestions
        .filter((suggestion) => suggestion.titleGenerationRunId === latestRunId)
        .sort((a, b) => a.position - b.position)
        .map((suggestion) => ({
          id: suggestion.id,
          text: suggestion.text,
          rationale: suggestion.rationale,
          hookType: suggestion.hookType,
          isFavorite: suggestion.isFavorite,
        }));

      const latestRun = latestRunByPlatform.get(platform) ?? null;
      return {
        platform,
        label: CONTENT_PLATFORM_LABELS[platform],
        estimatedCostCents,
        latestRun: latestRun ? toRunView(latestRun) : null,
        suggestions,
      };
    },
  );

  return {
    model: environment.OPENAI_TEXT_MODEL,
    optionCount,
    hasContext,
    promptVersion: TITLE_GENERATION_PROMPT_VERSION,
    platforms,
  };
}
