import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  mcpMutationInput,
  mcpWorkspaceInput,
  type McpPrincipal,
} from "@studio/contracts";
import {
  mcpPrepareGenerationInput,
  mcpExecuteGenerationInput,
  mcpGenerationOptionsInput,
  IMAGE_GENERATION_QUALITIES,
  IMAGE_GENERATION_SIZES,
  MAX_STANDALONE_AUDIO_SEGMENTS,
} from "@studio/contracts/mcp-generation";
import {
  getSceneAudioEnvironment,
  getSceneImageEnvironment,
} from "@/lib/env/server";
import { listVoicePresets } from "@/db/repositories/scene-audio.repository";
import { listLatestStylePresetVersions } from "@/db/repositories/scene-images.repository";
import {
  approveSceneAudioGeneration,
  rejectSceneAudioGeneration,
} from "@/db/commands/scene-audio-commands";
import { findSceneAudioGeneration } from "@/db/repositories/scene-audio.repository";
import { OPENAI_SPEECH_MAXIMUM_CHARACTERS } from "@/lib/speech/providers/openai-speech-provider";
import { GEMINI_MAXIMUM_CHARACTERS } from "@/lib/speech/providers/gemini-speech-provider";
import { authorizeMcp } from "./context";
import {
  prepareMcpGeneration,
  executeMcpGeneration,
  approveMcpGeneration,
  getMcpGenerationStatus,
} from "./generation-service";
import { toolResult, toolError, type McpToolRegistrar } from "./register-tool";
import { requireMcpProject } from "./project-access";
import { requireMcp } from "./errors";
import { mutateOnce } from "./operations";
import { mcpBaseUrl } from "./config";
import { enforceMcpRateLimit } from "./rate-limit";

const GENERATION_URI = "ui://vcstudio/generation-review.html";
export function registerGenerationTools(
  server: McpServer,
  register: McpToolRegistrar,
  principal: McpPrincipal,
) {
  register(
    "get_generation_options",
    "Read configured image/audio models, sizes, qualities, voice presets and style preset versions. No generation or spending. Use the returned IDs; do not invent presets. Library audio supports OpenAI/Gemini catalogue presets; scene audio retains existing voice support.",
    "vcstudio:generate",
    mcpGenerationOptionsInput,
    true,
    async (ctx, p) => {
      if (p.projectId) await requireMcpProject(ctx, p.projectId);
      const [voices, styles] = await Promise.all([
        listVoicePresets({ workspaceId: ctx.workspaceId }),
        listLatestStylePresetVersions({
          workspaceId: ctx.workspaceId,
          limit: 50,
        }),
      ]);
      const image = getSceneImageEnvironment(),
        audio = getSceneAudioEnvironment();
      return {
        image: {
          enabled: image.ENABLE_SCENE_IMAGE_GENERATION,
          provider: "openai",
          model: image.OPENAI_IMAGE_MODEL,
          sizes: IMAGE_GENERATION_SIZES,
          qualities: IMAGE_GENERATION_QUALITIES,
        },
        audio: {
          enabled: audio.ENABLE_SCENE_AUDIO_GENERATION,
          maximumStandaloneSegments: MAX_STANDALONE_AUDIO_SEGMENTS,
          maximumStandaloneCharacters: {
            openai: Math.min(
              audio.MAX_NARRATION_CHARACTERS,
              OPENAI_SPEECH_MAXIMUM_CHARACTERS,
            ),
            gemini: Math.min(
              audio.MAX_NARRATION_CHARACTERS,
              GEMINI_MAXIMUM_CHARACTERS,
            ),
          },
          voicePresets: voices.map((v) => ({
            id: v.id,
            name: v.name,
            provider: v.provider,
            model: v.model,
            voice: v.voice,
            format: v.format,
            standaloneSupported:
              !v.customVoiceId &&
              ["openai", "gemini"].includes(v.provider) &&
              ["mp3", "wav", "opus"].includes(v.format),
          })),
        },
        stylePresets: styles.map((s) => ({
          id: s.preset.id,
          versionId: s.version.id,
          name: s.version.name,
        })),
        videoGeneration: "on_hold",
        youtubeCommunityPublishing: "unsupported_by_public_api",
      };
    },
  );
  register(
    "execute_generation",
    "Execute an exact prepared image/audio generation only with owner-enabled autonomous generation for this connection/workspace. Use its operationId and the SAME idempotencyKey as prepare_generation. This starts billable work within the saved estimate and existing budgets. Poll get_generation_status; never blindly retry a failed generation with a new key. Review scene results explicitly using review_scene_image or review_scene_audio.",
    "vcstudio:generate",
    mcpExecuteGenerationInput,
    false,
    (ctx, p) => executeMcpGeneration(ctx, p.operationId, p.idempotencyKey),
  );
  register(
    "get_generation_status",
    "Inspect one generation operation, ready library asset ID or scene generation ID, processing/review state and safe failures. No paid request. Reuse the result with existing library, scene review or Social tools.",
    "vcstudio:read",
    mcpWorkspaceInput.extend({ operationId: z.uuid() }),
    true,
    (ctx, p) => getMcpGenerationStatus(ctx, p.operationId),
  );
  register(
    "review_scene_audio",
    "Explicitly approve or reject the exact successful current-scene audio generation. Agents with Review permission may call this themselves; no human UI checkpoint. Starts no generation and preserves current-scene revision checks.",
    "vcstudio:review",
    mcpMutationInput.extend({
      projectId: z.uuid(),
      generationId: z.uuid(),
      approve: z.boolean(),
    }),
    false,
    async (ctx, p) => {
      await requireMcpProject(ctx, p.projectId, "reviewSceneAudio");
      const audio = await findSceneAudioGeneration({
        ...p,
        workspaceId: ctx.workspaceId,
      });
      requireMcp(audio, "not_found", "That scene audio is unavailable.");
      return mutateOnce(ctx, "review_audio", p.idempotencyKey, p, async () => {
        const review = p.approve
          ? approveSceneAudioGeneration
          : rejectSceneAudioGeneration;
        await review({
          workspaceId: ctx.workspaceId,
          projectId: p.projectId,
          generationId: p.generationId,
          userId: ctx.principal.userId,
        });
        return { generationId: p.generationId, approved: p.approve };
      });
    },
  );
  registerAppTool(
    server,
    "prepare_generation",
    {
      description:
        "Prepare an exact image/audio cost preview without spending. kind image/audio creates a standalone library asset; scene_image/scene_audio uses the approved current project scene. Supply maximumCostCents explicitly. Preparation expires in ten minutes. Manual grants require the human review UI; autonomous grants let the assistant call execute_generation with the operation ID and SAME idempotency key, without asking the user again. Existing budget, feature, voice and scene checks remain mandatory. No video generation or YouTube Community publishing.",
      inputSchema: mcpPrepareGenerationInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: GENERATION_URI } },
    },
    async (args) => {
      try {
        const p = mcpPrepareGenerationInput.parse(args);
        const ctx = await authorizeMcp(
          principal,
          p.workspaceId,
          "vcstudio:generate",
        );
        await enforceMcpRateLimit(ctx, "write");
        const prepared = await prepareMcpGeneration(
          ctx,
          p.idempotencyKey,
          p.request,
        );
        return {
          ...toolResult({
            operation: prepared.operation,
            preview: prepared.preview,
            approvalMode: prepared.approvalMode,
            approvalUrl: `${mcpBaseUrl()}${prepared.operation.href}`,
          }),
          _meta: { approvalProof: prepared.uiProof },
        };
      } catch (e) {
        return toolError(e);
      }
    },
  );
  const confirmation = mcpWorkspaceInput.extend({
    operationId: z.uuid(),
    proof: z.string().min(32).max(128),
  });
  registerAppTool(
    server,
    "confirm_generation",
    {
      description:
        "User-interface-only generation approval; requires the private single-use proof. Never call from model reasoning.",
      inputSchema: confirmation,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args) => {
      try {
        const p = confirmation.parse(args);
        const ctx = await authorizeMcp(
          principal,
          p.workspaceId,
          "vcstudio:generate",
        );
        return toolResult(
          await approveMcpGeneration(ctx, p.operationId, p.proof),
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );
  registerAppResource(
    server,
    "Generation review",
    GENERATION_URI,
    {
      description:
        "Review the exact image or narration prompt, model, settings and cost before generation.",
    },
    async () => ({
      contents: [
        {
          uri: GENERATION_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readFile(
            path.join(process.cwd(), "public", "mcp", "generation.html"),
            "utf8",
          ),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: { connectDomains: [], resourceDomains: [] },
            },
          },
        },
      ],
    }),
  );
}
