"use server";

import { revalidatePath } from "next/cache";
import { upsertProjectSubtitleSettings } from "@/db/commands/subtitle-commands";
import { getProjectSubtitleSettings } from "@/db/repositories/subtitle.repository";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getSubtitleEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  coerceCaptionStyle,
  DEFAULT_CAPTION_STYLE,
} from "@/lib/subtitles/caption-style";
import type {
  CaptionStyleData,
  SubtitleGranularity,
  SubtitleSegmentTextOverrides,
} from "@/lib/subtitles/caption-style-data";
import type { SubtitleActionResult } from "@/lib/subtitles/subtitle-view";
import {
  updateSubtitleSegmentSchema,
  updateSubtitleSettingsSchema,
} from "@/lib/schemas/subtitle";

async function requireSubtitleAccess(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  requireCapability(context.activeMembership.role, "manageSubtitles");
  if (project.status === "archived") throw new Error("PROJECT_ARCHIVED");
  return { context, project };
}

async function resolveExistingSettings(input: {
  workspaceId: string;
  projectId: string;
}): Promise<{
  granularity: SubtitleGranularity;
  captionStyle: CaptionStyleData;
  overrides: SubtitleSegmentTextOverrides;
}> {
  const existing = await getProjectSubtitleSettings(input);
  if (existing)
    return {
      granularity: existing.granularity,
      captionStyle: coerceCaptionStyle(existing.captionStyle),
      overrides: existing.segmentTextOverrides ?? {},
    };
  return {
    granularity: "sentence",
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      maxLineCharacters: getSubtitleEnvironment().SUBTITLE_MAX_LINE_CHARACTERS,
    },
    overrides: {},
  };
}

export async function updateSubtitleSettingsAction(
  formData: FormData,
): Promise<SubtitleActionResult> {
  const rawStyle = formData.get("captionStyle");
  let styleInput: unknown = undefined;
  if (typeof rawStyle === "string" && rawStyle.length > 0) {
    try {
      styleInput = JSON.parse(rawStyle);
    } catch {
      return { success: false, error: "The caption style is invalid." };
    }
  }

  const parsed = updateSubtitleSettingsSchema.safeParse({
    projectId: formData.get("projectId"),
    granularity: formData.get("granularity"),
    captionStyle: styleInput,
  });
  if (!parsed.success)
    return { success: false, error: "The subtitle settings are invalid." };

  try {
    const { context } = await requireSubtitleAccess(parsed.data.projectId);
    const workspaceId = context.activeMembership.workspaceId;
    const existing = await resolveExistingSettings({
      workspaceId,
      projectId: parsed.data.projectId,
    });
    await upsertProjectSubtitleSettings({
      workspaceId,
      projectId: parsed.data.projectId,
      updatedByUserId: context.user.id,
      granularity: parsed.data.granularity,
      captionStyle: parsed.data.captionStyle,
      segmentTextOverrides: existing.overrides,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/subtitles`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "The subtitle settings could not be saved.",
    };
  }
}

export async function updateSubtitleSegmentAction(
  formData: FormData,
): Promise<SubtitleActionResult> {
  const parsed = updateSubtitleSegmentSchema.safeParse({
    projectId: formData.get("projectId"),
    segmentKey: formData.get("segmentKey"),
    text: formData.get("text") ?? "",
  });
  if (!parsed.success)
    return { success: false, error: "The caption edit is invalid." };

  try {
    const { context } = await requireSubtitleAccess(parsed.data.projectId);
    const workspaceId = context.activeMembership.workspaceId;
    const existing = await resolveExistingSettings({
      workspaceId,
      projectId: parsed.data.projectId,
    });

    const overrides = { ...existing.overrides };
    if (parsed.data.text.trim().length === 0)
      delete overrides[parsed.data.segmentKey];
    else overrides[parsed.data.segmentKey] = parsed.data.text.trim();

    await upsertProjectSubtitleSettings({
      workspaceId,
      projectId: parsed.data.projectId,
      updatedByUserId: context.user.id,
      granularity: existing.granularity,
      captionStyle: existing.captionStyle,
      segmentTextOverrides: overrides,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/subtitles`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The caption could not be saved." };
  }
}
