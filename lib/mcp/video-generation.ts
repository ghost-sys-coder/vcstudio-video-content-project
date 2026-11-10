import "server-only";
import { requireElevenLabs } from "@/lib/elevenlabs/configuration";
import type { McpGenerationRequest } from "@studio/contracts/mcp-generation";
import type { McpContext } from "./context";
import { can } from "@/lib/policies/workspace-policy";
import { planAuthorizedVideoRequest } from "@/lib/video-generation/video-generation-service";
import { findVideoModel } from "@/lib/video-generation/video-model-catalog";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { requireMcpProject } from "./project-access";
import { requireMcp } from "./errors";

export async function buildMcpVideoPlan(
  ctx: McpContext,
  request: Extract<McpGenerationRequest, { kind: "video" }>,
) {
  requireMcp(
    can(ctx.membership.role, "manageMediaLibrary"),
    "permission_denied",
    "Your role cannot generate library videos.",
  );
  // Google's existing billing hold is independent of ElevenLabs access.
  requireMcp(
    findVideoModel(request.video.modelId)?.provider === "elevenlabs",
    "feature_unavailable",
    "MCP video generation currently exposes only ElevenLabs. Other video providers retain their existing operating controls.",
  );
  requireElevenLabs(true);
  const target = request.video.target;
  if (target.kind === "scene") {
    await requireMcpProject(ctx, target.projectId, "generateSceneImages");
    const scene = await findCurrentScene({
      workspaceId: ctx.workspaceId,
      projectId: target.projectId,
      sceneId: target.sceneId,
    });
    requireMcp(
      scene?.scene.status === "approved" &&
        scene.version.id === target.sceneVersionId &&
        scene.scene.currentVersion === target.expectedSceneVersion,
      "conflict",
      "Approve the exact current scene before generating footage.",
    );
  }
  const planned = await planAuthorizedVideoRequest(
    { workspaceId: ctx.workspaceId, userId: ctx.principal.userId },
    request.video,
  );
  return {
    kind: "video" as const,
    provider: planned.model.provider,
    model: planned.model.name,
    estimatedCostCents: planned.plan.estimatedCostCents,
    request: planned.plan.request,
    modelSnapshot: planned.model,
    pricingSnapshot: planned.pricing,
    assetsDigest: planned.quoteContext.assetsDigest,
  };
}
