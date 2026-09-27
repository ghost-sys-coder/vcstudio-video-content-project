import "server-only";

import {
  renderVideoChaptersPrompt,
  VIDEO_CHAPTERS_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project, VideoRender } from "@/db/schema";
import { listCurrentSceneNarrations } from "@/db/repositories/scenes.repository";
import {
  describeRenderForChapters,
  type RenderChapterSource,
} from "@/lib/chapters/render-chapter-source";
import {
  canHaveChapters,
  isShortsShaped,
  targetChapterRange,
} from "@/lib/chapters/youtube-chapters";
import { estimateChapterGenerationCost } from "@/lib/costs/chapter-generation-cost";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";

export type ChapterGenerationPlan =
  | {
      eligible: true;
      prompt: string;
      promptVersion: string;
      model: string;
      source: RenderChapterSource;
      estimatedCostCents: number;
    }
  | { eligible: false; reason: string };

/**
 * Everything decided before money is spent: whether this render can have
 * chapters at all, the exact prompt, and what it will cost. Used both to show
 * the estimate and to start the run, so the two can never disagree.
 */
export async function prepareChapterGeneration(input: {
  workspaceId: string;
  project: Project;
  render: VideoRender;
}): Promise<ChapterGenerationPlan> {
  const { render } = input;
  if (render.status !== "succeeded" || !render.assetObjectKey)
    return {
      eligible: false,
      reason: "Chapters can only be made for a finished render.",
    };
  if (isShortsShaped(render))
    return {
      eligible: false,
      reason: "YouTube does not show chapters on vertical Shorts.",
    };
  if (!canHaveChapters(render.timelineSnapshot.totalDurationMilliseconds))
    return {
      eligible: false,
      reason:
        "This video is under 30 seconds, too short for YouTube's minimum of three 10-second chapters.",
    };

  const narrations = render.timelineSnapshot.scenes.some((scene) =>
    scene.captions.every((caption) => caption.text.trim() === ""),
  )
    ? await listCurrentSceneNarrations({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        sceneIds: render.timelineSnapshot.scenes.map((scene) => scene.sceneId),
      })
    : new Map<string, string>();
  const source = describeRenderForChapters(render.timelineSnapshot, narrations);
  const range = targetChapterRange(source.videoDurationMilliseconds);
  const prompt = renderVideoChaptersPrompt({
    projectTitle: input.project.name,
    language: input.project.language,
    minimumChapters: range.minimum,
    maximumChapters: range.maximum,
    scenes: source.promptScenes,
  });

  const environment = getSceneAnalysisEnvironment();
  return {
    eligible: true,
    prompt,
    promptVersion: VIDEO_CHAPTERS_PROMPT_VERSION,
    model: environment.OPENAI_TEXT_MODEL,
    source,
    estimatedCostCents: estimateChapterGenerationCost({
      prompt,
      maximumChapters: range.maximum,
      inputCostPerMillionCents:
        environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
      outputCostPerMillionCents:
        environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
    }).estimatedCostCents,
  };
}
