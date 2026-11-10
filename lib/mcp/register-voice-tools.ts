import "server-only";
import { sceneVisualSelectionSchema } from "@studio/contracts/video";
import {
  saveAuthorizedSceneVideoSelection,
  reviewAuthorizedSceneVideoSelection,
} from "@/lib/video-generation/scene-video-service";
import { requireMcpProject } from "./project-access";
import { z } from "zod";
import { mcpMutationInput, mcpWorkspaceInput } from "@studio/contracts";
import { createVoicePreset } from "@/db/commands/voice-preset-commands";
import { voicePresetInputSchema } from "@studio/contracts/voice-preset";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  listElevenLabsVoices,
  validateElevenLabsPreset,
} from "@/lib/elevenlabs/voices";
import { requireElevenLabs } from "@/lib/elevenlabs/configuration";
import type { McpToolRegistrar } from "./register-tool";
import { mutateOnce } from "./operations";
export function registerVoiceTools(register: McpToolRegistrar) {
  register(
    "assign_scene_video",
    "Assign an inspected ready library video to the exact current project scene. Creates an independent project-owned copy, awaiting review; preserves the library original. Use current sceneVersionId and expectedRevision (0 when none). Keeps project narration; clip sound is muted during assembly. Does not generate or publish.",
    "vcstudio:media",
    mcpMutationInput.extend({ selection: sceneVisualSelectionSchema }),
    false,
    async (ctx, p) => {
      await requireMcpProject(
        ctx,
        p.selection.projectId,
        "generateSceneImages",
      );
      return mutateOnce(
        ctx,
        "assign_scene_video",
        p.idempotencyKey,
        p,
        async () => ({
          ...(await saveAuthorizedSceneVideoSelection(
            { workspaceId: ctx.workspaceId, userId: ctx.principal.userId },
            p.selection,
          )),
        }),
      );
    },
  );
  register(
    "review_scene_video",
    "Explicitly approve or reject the exact current scene footage revision. Use get_scene.videoSelection.revision; do not approve a changed selection. Review permission is required; no spending, rendering or publishing.",
    "vcstudio:review",
    mcpMutationInput.extend({
      projectId: z.uuid(),
      sceneId: z.uuid(),
      expectedRevision: z.number().int().positive(),
      reviewStatus: z.enum(["approved", "rejected"]),
    }),
    false,
    async (ctx, p) => {
      await requireMcpProject(ctx, p.projectId, "reviewSceneImages");
      return mutateOnce(
        ctx,
        "review_scene_video",
        p.idempotencyKey,
        p,
        async () => ({
          ...(await reviewAuthorizedSceneVideoSelection(
            { workspaceId: ctx.workspaceId, userId: ctx.principal.userId },
            p,
          )),
        }),
      );
    },
  );
  register(
    "list_generation_voices",
    "List existing ElevenLabs account voices for narration and standalone audio. Read-only, paginated; never enrols or clones a voice. Uses the private in-house provider only. No spending.",
    "vcstudio:generate",
    mcpWorkspaceInput.extend({ cursor: z.string().max(500).optional() }),
    true,
    async (ctx, p) => {
      requireCapability(ctx.membership.role, "manageVoicePresets");
      const env = requireElevenLabs();
      return {
        provider: "elevenlabs",
        model: env.ELEVENLABS_TTS_MODEL,
        ...(await listElevenLabsVoices(p.cursor)),
        formats: ["mp3", "wav", "opus"],
        speedPercent: { minimum: 70, maximum: 120 },
        instructionsSupported: false,
      };
    },
  );
  register(
    "create_generation_voice_preset",
    "Save a reusable ElevenLabs account voice preset, after list_generation_voices. Use its exact voice ID and configured model. No generation, voice cloning or spending. Instructions must be empty; speed 70–120%. The preset can then be used by prepare_generation for library or scene audio.",
    "vcstudio:generate",
    mcpMutationInput.extend({
      preset: voicePresetInputSchema
        .extend({ provider: z.literal("elevenlabs") })
        .strict(),
    }),
    false,
    async (ctx, p) => {
      requireCapability(ctx.membership.role, "manageVoicePresets");
      await validateElevenLabsPreset(p.preset);
      return mutateOnce(
        ctx,
        "create_voice_preset",
        p.idempotencyKey,
        p,
        async () => {
          const row = await createVoicePreset({
            ...p.preset,
            workspaceId: ctx.workspaceId,
            createdByUserId: ctx.principal.userId,
          });
          return {
            voicePresetId: row.id,
            provider: row.provider,
            model: row.model,
            voice: row.voice,
            format: row.format,
          };
        },
      );
    },
  );
}
