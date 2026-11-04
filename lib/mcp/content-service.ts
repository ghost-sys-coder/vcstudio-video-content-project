import "server-only";
import { z } from "zod";
import { createProject } from "@/db/commands/create-project.command";
import { saveProjectBrief } from "@/db/commands/project-brief.command";
import {
  createScriptVersion,
  restoreScriptVersion,
  saveScriptDraft,
} from "@/db/commands/script-commands";
import {
  approveScriptVersion,
  approveScene,
  updateScene,
} from "@/db/commands/scene-commands";
import { createManualScene } from "@/db/commands/create-manual-scene";
import {
  approveSceneImageGeneration,
  rejectSceneImageGeneration,
} from "@/db/commands/scene-image-commands";
import { findSceneImageGeneration } from "@/db/repositories/scene-images.repository";
import {
  createProjectSchema,
  briefSchema,
  createScriptContentSchema,
} from "@/lib/schemas/project";
import { createSceneSchema, updateSceneSchema } from "@/lib/schemas/scene";
import { getProjectEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import type { McpContext } from "./context";
import { requireMcpProject } from "./project-access";
import { mutateOnce } from "./operations";
import { requireMcp } from "./errors";

export async function createMcpProject(
  context: McpContext,
  key: string,
  parsed: z.infer<typeof createProjectSchema>,
) {
  requireCapability(context.membership.role, "mutateWorkspaceData");
  // Reference-bearing creation belongs to the existing UI until those selectors
  // are exposed: never bypass their ownership/version resolution.
  requireMcp(
    !parsed.channelProfileId && !parsed.formatPresetId && !parsed.stylePresetId,
    "invalid_input",
    "Create the basic project first, then configure its channel and presets in VCStudio.",
  );
  return mutateOnce(context, "create_project", key, parsed, async () => {
    const project = await createProject({
      ...parsed,
      workspaceId: context.workspaceId,
      userId: context.principal.userId,
    });
    return { projectId: project.id, href: `/app/projects/${project.id}` };
  });
}
export async function updateMcpBrief(
  context: McpContext,
  key: string,
  input: unknown,
) {
  const parsed = briefSchema.parse(input);
  await requireMcpProject(context, parsed.projectId, "mutateWorkspaceData");
  return mutateOnce(context, "save_brief", key, parsed, async () => {
    const updatedAt = await saveProjectBrief({
      ...parsed,
      targetDurationSeconds: parsed.targetDurationSeconds ?? null,
      workspaceId: context.workspaceId,
      userId: context.principal.userId,
      expectedUpdatedAt: parsed.expectedUpdatedAt
        ? new Date(parsed.expectedUpdatedAt)
        : null,
    });
    requireMcp(
      updatedAt,
      "conflict",
      "This brief changed. Read the current project before saving again.",
    );
    return { projectId: parsed.projectId, updatedAt: updatedAt.toISOString() };
  });
}
export async function mutateMcpScript(
  context: McpContext,
  key: string,
  input: {
    projectId: string;
    revision: number;
    content?: string;
    versionId?: string;
  },
  kind:
    | "save_script"
    | "create_script_version"
    | "restore_script_version"
    | "approve_script_version",
) {
  await requireMcpProject(
    context,
    input.projectId,
    kind === "approve_script_version"
      ? "approveScripts"
      : "mutateWorkspaceData",
  );
  const common = {
    workspaceId: context.workspaceId,
    userId: context.principal.userId,
    projectId: input.projectId,
    revision: input.revision,
  };
  return mutateOnce(context, kind, key, input, async () => {
    if (kind === "save_script") {
      const content = createScriptContentSchema(
        getProjectEnvironment().MAX_SCRIPT_CHARACTERS,
      ).parse(input.content);
      const saved = await saveScriptDraft({ ...common, content });
      return { revision: saved.revision, projectId: input.projectId };
    }
    if (kind === "create_script_version") {
      const version = await createScriptVersion(common);
      return { versionId: version.id, versionNumber: version.versionNumber };
    }
    const versionId = z.uuid().parse(input.versionId);
    if (kind === "restore_script_version")
      return restoreScriptVersion({ ...common, versionId });
    await approveScriptVersion({ ...common, scriptVersionId: versionId });
    return { versionId, approved: true };
  });
}
export async function mutateMcpScene(
  context: McpContext,
  key: string,
  input: unknown,
  kind: "create_scene" | "update_scene",
) {
  if (kind === "create_scene") {
    const parsed = createSceneSchema.parse(input);
    await requireMcpProject(context, parsed.projectId, "editScenes");
    return mutateOnce(context, kind, key, parsed, async () =>
      createManualScene({
        ...parsed,
        workspaceId: context.workspaceId,
        userId: context.principal.userId,
      }),
    );
  }
  const parsed = updateSceneSchema.parse(input);
  await requireMcpProject(context, parsed.projectId, "editScenes");
  return mutateOnce(context, kind, key, parsed, async () => {
    await updateScene({
      ...parsed,
      workspaceId: context.workspaceId,
      userId: context.principal.userId,
    });
    return { sceneId: parsed.sceneId };
  });
}
export async function approveMcpScene(
  context: McpContext,
  key: string,
  input: { projectId: string; sceneId: string; expectedVersion: number },
) {
  await requireMcpProject(context, input.projectId, "approveScenes");
  return mutateOnce(context, "approve_scene", key, input, async () => {
    await approveScene({ ...input, workspaceId: context.workspaceId });
    return { sceneId: input.sceneId, approved: true };
  });
}
export async function reviewMcpImage(
  context: McpContext,
  key: string,
  input: { projectId: string; generationId: string; approve: boolean },
) {
  await requireMcpProject(context, input.projectId, "reviewSceneImages");
  const image = await findSceneImageGeneration({
    ...input,
    workspaceId: context.workspaceId,
  });
  requireMcp(image, "not_found", "That scene image is unavailable.");
  return mutateOnce(context, "review_image", key, input, async () => {
    if (input.approve)
      await approveSceneImageGeneration({
        workspaceId: context.workspaceId,
        projectId: input.projectId,
        generationId: image.id,
        userId: context.principal.userId,
      });
    else
      await rejectSceneImageGeneration({
        workspaceId: context.workspaceId,
        projectId: input.projectId,
        generationId: image.id,
        userId: context.principal.userId,
      });
    return { generationId: image.id, approved: input.approve };
  });
}
