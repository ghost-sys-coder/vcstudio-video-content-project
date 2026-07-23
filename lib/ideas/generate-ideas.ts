import "server-only";

import {
  IDEA_GENERATION_PROMPT_VERSION,
  renderIdeaGenerationPrompt,
} from "@studio/prompts";
import type { ContentPlatform } from "@/db/schema";
import {
  recordFailedIdeaGenerationRun,
  recordIdeaGenerationRun,
} from "@/db/commands/idea-commands";
import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import { isHistoricalContent } from "@/lib/domain/historical-content";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { classifyOpenAiError } from "@/lib/openai/openai-error";
import { OpenAiTextGenerationProvider } from "@/lib/openai/openai-text-generation-provider";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type { GeneratedIdea } from "@/lib/schemas/idea-generation";
import type { TextGenerationProvider } from "@/lib/openai/text-generation-provider";

export class IdeaGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdeaGenerationRequestError";
  }
}

/**
 * Generate idea cards for a niche in one shot. Unlike the project-scoped money
 * ops, this is deliberately OFF the usage-reservation ledger: it is a sub-cent
 * text call guarded by the per-workspace rate limit, and its actual spend is
 * recorded in `content_idea_generation_runs` for visibility. Returns the run id
 * and the ephemeral cards (the user chooses which to save afterward).
 */
export async function generateIdeas(
  input: {
    workspaceId: string;
    userId: string;
    niche: string;
    platform: ContentPlatform | null;
    tonePreference: string | null;
    language: string;
    count: number;
  },
  provider: TextGenerationProvider = new OpenAiTextGenerationProvider(),
): Promise<{ runId: string; ideas: GeneratedIdea[] }> {
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "idea_generation",
  });

  const environment = getSceneAnalysisEnvironment();
  const prompt = renderIdeaGenerationPrompt({
    niche: input.niche,
    count: input.count,
    platform: input.platform,
    tonePreference: input.tonePreference,
    language: input.language,
    requireHistoricalAccuracy: isHistoricalContent({ niche: input.niche }),
  });

  const runSnapshot = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    niche: input.niche,
    platform: input.platform,
    tonePreference: input.tonePreference,
    language: input.language,
    requestedCount: input.count,
    model: environment.OPENAI_TEXT_MODEL,
    promptVersion: IDEA_GENERATION_PROMPT_VERSION,
    finalPrompt: prompt,
  };

  try {
    const result = await provider.generateIdeas({
      model: environment.OPENAI_TEXT_MODEL,
      prompt,
    });
    const actualCostCents = calculateTextCostCents({
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      inputCostPerMillionCents:
        environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
      outputCostPerMillionCents:
        environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
    });
    const run = await recordIdeaGenerationRun({
      ...runSnapshot,
      resultCount: result.output.ideas.length,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      actualCostCents,
      providerRequestId: result.requestId,
    });
    return { runId: run.id, ideas: result.output.ideas };
  } catch (error) {
    const failure = classifyOpenAiError(error);
    // classifyOpenAiError carries scene-analysis wording; surface an
    // idea-appropriate, user-safe message instead of leaking the raw one.
    const message = failure.retriable
      ? "The idea generator is busy right now. Please try again in a moment."
      : "The idea generator could not complete. Please try again.";
    await recordFailedIdeaGenerationRun({
      ...runSnapshot,
      category: failure.category,
      message,
    });
    throw new IdeaGenerationRequestError(message);
  }
}
