import "server-only";

import type { ChapterGenerationRun, Project } from "@/db/schema";
import {
  findLatestChapterGenerationRunForRender,
  findVideoRenderChapters,
} from "@/db/repositories/chapter-generation.repository";
import {
  findVideoRender,
  listFinishedRendersForChapters,
} from "@/db/repositories/video-render.repository";
import { prepareChapterGeneration } from "@/lib/chapters/prepare-chapter-generation";
import {
  canHaveChapters,
  formatChapterTimestamp,
  isShortsShaped,
  type ChapterSceneTiming,
  type VideoChapter,
} from "@/lib/chapters/youtube-chapters";

export type ChapterRenderOption = {
  id: string;
  label: string;
  ineligibleReason: string | null;
};

export type ChapterRunView = {
  id: string;
  status: ChapterGenerationRun["status"];
  errorCategory: string | null;
  safeErrorMessage: string | null;
  estimatedCostCents: number;
  actualCostCents: number | null;
};

export type SelectedRenderChaptersView = {
  renderId: string;
  videoDurationMilliseconds: number;
  /** Null when this render cannot have chapters; see `ineligibleReason`. */
  estimatedCostCents: number | null;
  ineligibleReason: string | null;
  /** Scenes described from current narration, because the render kept no captions. */
  scenesFromCurrentNarration: number;
  /** Where scenes start in this render: the only times a chapter may start. */
  sceneStarts: ChapterSceneTiming[];
  saved: {
    chapters: VideoChapter[];
    includeInYouTubeDescription: boolean;
    version: number;
    source: string;
  } | null;
  latestRun: ChapterRunView | null;
};

export type ChaptersView = {
  renders: ChapterRenderOption[];
  selected: SelectedRenderChaptersView | null;
};

export type ChapterActionResult = { success: boolean; error: string | null };

function ineligibleReason(render: {
  width: number;
  height: number;
  durationMilliseconds: number;
}): string | null {
  if (isShortsShaped(render))
    return "YouTube does not show chapters on vertical Shorts.";
  if (!canHaveChapters(render.durationMilliseconds))
    return "Too short: YouTube needs three chapters of at least 10 seconds.";
  return null;
}

function renderLabel(render: {
  createdAt: Date;
  width: number;
  height: number;
  durationMilliseconds: number;
}): string {
  const created = `${render.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  const length = formatChapterTimestamp(
    render.durationMilliseconds,
    render.durationMilliseconds,
  );
  return `${created} · ${render.width}×${render.height} · ${length}`;
}

/**
 * The chapters panel for one project: its finished renders, and everything
 * about the chosen one. Only the chosen render's timeline is loaded, because a
 * snapshot is large and the picker needs none of it.
 */
export async function loadChaptersView(input: {
  workspaceId: string;
  project: Project;
  renderId?: string | null;
}): Promise<ChaptersView> {
  const finished = await listFinishedRendersForChapters({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });
  const renders = finished.map((render) => ({
    id: render.id,
    label: renderLabel(render),
    ineligibleReason: ineligibleReason(render),
  }));
  const chosen =
    renders.find((render) => render.id === input.renderId) ??
    renders.find((render) => render.ineligibleReason === null) ??
    renders[0];
  if (!chosen) return { renders, selected: null };

  const scope = {
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    renderId: chosen.id,
  };
  const [render, saved, latestRun] = await Promise.all([
    findVideoRender(scope),
    findVideoRenderChapters(scope),
    findLatestChapterGenerationRunForRender(scope),
  ]);
  if (!render) return { renders, selected: null };

  const plan = await prepareChapterGeneration({
    workspaceId: input.workspaceId,
    project: input.project,
    render,
  });
  const snapshot = render.timelineSnapshot;
  return {
    renders,
    selected: {
      renderId: render.id,
      videoDurationMilliseconds: snapshot.totalDurationMilliseconds,
      estimatedCostCents: plan.eligible ? plan.estimatedCostCents : null,
      ineligibleReason: plan.eligible ? null : plan.reason,
      scenesFromCurrentNarration: plan.eligible
        ? plan.source.scenesFromCurrentNarration
        : 0,
      sceneStarts: [...snapshot.scenes]
        .sort((left, right) => left.startMilliseconds - right.startMilliseconds)
        .map((scene) => ({
          sceneNumber: scene.sceneNumber,
          startMilliseconds: scene.startMilliseconds,
        })),
      saved: saved
        ? {
            chapters: saved.chapters,
            includeInYouTubeDescription: saved.includeInYouTubeDescription,
            version: saved.version,
            source: saved.source,
          }
        : null,
      latestRun: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            errorCategory: latestRun.errorCategory,
            safeErrorMessage: latestRun.safeErrorMessage,
            estimatedCostCents: latestRun.estimatedCostCents,
            actualCostCents: latestRun.actualCostCents,
          }
        : null,
    },
  };
}
