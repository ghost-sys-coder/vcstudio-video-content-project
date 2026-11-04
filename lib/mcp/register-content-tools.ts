import { z } from "zod";
import {
  mcpMutationInput,
  mcpPageInput,
  mcpWorkspaceInput,
} from "@studio/contracts";
import { createProjectSchema, briefSchema } from "@/lib/schemas/project";
import {
  createSceneSchema,
  updateSceneSchema,
  approveSceneSchema,
} from "@/lib/schemas/scene";
import {
  listProjects,
  findProjectScriptDraft,
  findProjectScriptVersion,
  listProjectScriptVersions,
} from "@/db/repositories/projects.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { loadProjectProductionReadiness } from "@/db/repositories/production-queue.repository";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { listSceneImageGenerationSummaries } from "@/db/repositories/scene-images.repository";
import { listMcpSceneWindow } from "@/db/repositories/mcp-content.repository";
import {
  createMcpProject,
  updateMcpBrief,
  mutateMcpScript,
  mutateMcpScene,
  approveMcpScene,
  reviewMcpImage,
} from "./content-service";
import { requireMcpProject } from "./project-access";
import type { McpToolRegistrar } from "./register-tool";
import { requireMcp } from "./errors";
import { mutateOnce } from "./operations";

export function registerContentTools(register: McpToolRegistrar) {
  const project = mcpWorkspaceInput.extend({ projectId: z.uuid() });
  register(
    "list_projects",
    "List a bounded page of projects in an explicitly authorized workspace.",
    "vcstudio:read",
    mcpPageInput,
    true,
    (ctx, p) => listProjects({ ...p, workspaceId: ctx.workspaceId }),
  );
  register(
    "get_project",
    "Read a project, brief and production readiness with missing-media blockers.",
    "vcstudio:read",
    project,
    true,
    async (ctx, p) => {
      const row = await requireMcpProject(ctx, p.projectId);
      const [brief, readiness] = await Promise.all([
        findProjectBrief({
          workspaceId: ctx.workspaceId,
          projectId: p.projectId,
        }),
        loadProjectProductionReadiness({
          workspaceId: ctx.workspaceId,
          projectId: p.projectId,
        }),
      ]);
      return { project: row, brief, readiness };
    },
  );
  register(
    "create_project",
    "Create a basic project without starting generation. Specify budget in cents; zero disables paid production.",
    "vcstudio:edit",
    mcpMutationInput.extend(createProjectSchema.shape),
    false,
    (ctx, p) => createMcpProject(ctx, p.idempotencyKey, p),
  );
  register(
    "update_project_brief",
    "Save the project brief without generating a script or any media.",
    "vcstudio:edit",
    mcpMutationInput.extend(briefSchema.shape).extend({
      expectedUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    }),
    false,
    (ctx, p) => updateMcpBrief(ctx, p.idempotencyKey, p),
  );
  register(
    "get_script",
    "Read the current script draft and revision. Use that revision when saving; never overwrite a conflict.",
    "vcstudio:read",
    project,
    true,
    async (ctx, p) => {
      await requireMcpProject(ctx, p.projectId);
      return findProjectScriptDraft({
        workspaceId: ctx.workspaceId,
        projectId: p.projectId,
      });
    },
  );
  register(
    "list_script_versions",
    "Read up to 50 immutable script versions, newest first.",
    "vcstudio:read",
    project,
    true,
    async (ctx, p) => {
      await requireMcpProject(ctx, p.projectId);
      return (
        await listProjectScriptVersions({
          workspaceId: ctx.workspaceId,
          projectId: p.projectId,
        })
      ).map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        characterCount: v.characterCount,
        createdAt: v.createdAt,
      }));
    },
  );
  register(
    "get_script_version",
    "Read one specified immutable script version.",
    "vcstudio:read",
    project.extend({ versionId: z.uuid() }),
    true,
    async (ctx, p) => {
      await requireMcpProject(ctx, p.projectId);
      return findProjectScriptVersion({ ...p, workspaceId: ctx.workspaceId });
    },
  );
  const script = mcpMutationInput.extend({
    projectId: z.uuid(),
    revision: z.number().int().min(0),
  });
  register(
    "save_script_draft",
    "Save narration written in this conversation. No provider call. Requires the current draft revision.",
    "vcstudio:edit",
    script.extend({ content: z.string().max(250000) }),
    false,
    (ctx, p) => mutateMcpScript(ctx, p.idempotencyKey, p, "save_script"),
  );
  register(
    "create_script_version",
    "Freeze the exact current draft as an unapproved script version.",
    "vcstudio:edit",
    script,
    false,
    (ctx, p) =>
      mutateMcpScript(ctx, p.idempotencyKey, p, "create_script_version"),
  );
  register(
    "restore_script_version",
    "Restore a historical version as a new version, preserving history and revision checks.",
    "vcstudio:edit",
    script.extend({ versionId: z.uuid() }),
    false,
    (ctx, p) =>
      mutateMcpScript(ctx, p.idempotencyKey, p, "restore_script_version"),
  );
  register(
    "approve_script_version",
    "Explicitly approve a specified immutable script version. This starts no generation.",
    "vcstudio:review",
    script.extend({ versionId: z.uuid() }),
    false,
    (ctx, p) =>
      mutateMcpScript(ctx, p.idempotencyKey, p, "approve_script_version"),
  );
  register(
    "list_scenes",
    "Read a bounded page of current scenes and their immutable versions.",
    "vcstudio:read",
    mcpPageInput.extend({ projectId: z.uuid() }),
    true,
    async (ctx, p) => {
      await requireMcpProject(ctx, p.projectId);
      const rows = await listMcpSceneWindow({
        ...p,
        workspaceId: ctx.workspaceId,
      });
      return {
        items: rows.slice(0, p.pageSize),
        nextPage: rows.length > p.pageSize ? p.page + 1 : null,
      };
    },
  );
  register(
    "get_scene",
    "Read a current scene and bounded image review history. Images are not automatically approved.",
    "vcstudio:read",
    project.extend({ sceneId: z.uuid() }),
    true,
    async (ctx, p) => {
      await requireMcpProject(ctx, p.projectId);
      const current = await findCurrentScene({
        ...p,
        workspaceId: ctx.workspaceId,
      });
      requireMcp(current, "not_found", "That scene is unavailable.");
      const images = await listSceneImageGenerationSummaries({
        ...p,
        workspaceId: ctx.workspaceId,
        sceneVersionId: current.version.id,
        limit: 24,
      });
      return {
        ...current,
        images: images.map((i) => ({
          id: i.generation.id,
          size: i.generation.size,
          status: i.generation.status,
          reviewStatus: i.generation.reviewStatus,
          source: i.generation.source,
        })),
      };
    },
  );
  register(
    "create_scene",
    "Create one manual scene from the supplied production brief, without paid analysis.",
    "vcstudio:edit",
    mcpMutationInput.extend(createSceneSchema.shape),
    false,
    (ctx, p) => mutateMcpScene(ctx, p.idempotencyKey, p, "create_scene"),
  );
  register(
    "update_scene",
    "Edit a current scene with version protection and existing media compatibility rules.",
    "vcstudio:edit",
    mcpMutationInput.extend(updateSceneSchema.shape),
    false,
    (ctx, p) => mutateMcpScene(ctx, p.idempotencyKey, p, "update_scene"),
  );
  register(
    "import_scenes",
    "Import up to 20 structured manual scenes. Each scene has a stable per-item request key so retries cannot duplicate earlier scenes.",
    "vcstudio:edit",
    mcpMutationInput.extend({
      projectId: z.uuid(),
      scenes: z
        .array(createSceneSchema.omit({ projectId: true }))
        .min(1)
        .max(20),
    }),
    false,
    async (ctx, p) =>
      mutateOnce(ctx, "import_scenes", p.idempotencyKey, p, async () => {
        const results = [];
        for (const [index, scene] of p.scenes.entries())
          results.push(
            await mutateMcpScene(
              ctx,
              `${p.idempotencyKey}:${index}`,
              { ...scene, projectId: p.projectId },
              "create_scene",
            ),
          );
        return { operations: results };
      }),
  );
  register(
    "approve_scene",
    "Explicitly approve the current scene version, without generating media.",
    "vcstudio:review",
    mcpMutationInput.extend(approveSceneSchema.shape),
    false,
    (ctx, p) => approveMcpScene(ctx, p.idempotencyKey, p),
  );
  register(
    "review_scene_image",
    "Explicitly approve or reject a specified scene image. Import and assignment never automatically approve it.",
    "vcstudio:review",
    mcpMutationInput.extend({
      projectId: z.uuid(),
      generationId: z.uuid(),
      approve: z.boolean(),
    }),
    false,
    (ctx, p) => reviewMcpImage(ctx, p.idempotencyKey, p),
  );
}
