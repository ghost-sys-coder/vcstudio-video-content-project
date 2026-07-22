import "server-only";

import type { Project, ProjectOutputVariant } from "@/db/schema";
import {
  findProjectOutputVariant,
  listProjectOutputVariants,
  listSceneVariantFramings,
} from "@/db/repositories/output-variants.repository";
import { buildSubtitleContext } from "@/lib/subtitles/subtitle-workspace-details";

export class OutputVariantNotFoundError extends Error {
  constructor() {
    super("The selected output format was not found.");
    this.name = "OutputVariantNotFoundError";
  }
}

export async function resolveProjectOutputVariant(input: {
  workspaceId: string;
  project: Project;
  outputVariantId?: string | null;
}): Promise<ProjectOutputVariant> {
  if (input.outputVariantId) {
    const selected = await findProjectOutputVariant({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      outputVariantId: input.outputVariantId,
    });
    if (!selected) throw new OutputVariantNotFoundError();
    return selected;
  }

  const variants = await listProjectOutputVariants({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });
  const projectDefault = variants.find(
    (variant) => variant.aspectRatio === input.project.aspectRatio,
  );
  if (!projectDefault) throw new OutputVariantNotFoundError();
  return projectDefault;
}

export async function buildOutputVariantTimelineContext(input: {
  workspaceId: string;
  project: Project;
  outputVariant: ProjectOutputVariant;
}) {
  const framings = await listSceneVariantFramings({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    outputVariantId: input.outputVariant.id,
  });
  return buildSubtitleContext({
    workspaceId: input.workspaceId,
    project: input.project,
    output: {
      width: input.outputVariant.width,
      height: input.outputVariant.height,
      captionStyle: input.outputVariant.captionStyle,
      framings,
    },
  });
}
