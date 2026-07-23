import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit/enforce-rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => {}),
}));
vi.mock("@/lib/env/server", () => ({
  getSceneAnalysisEnvironment: () => ({
    OPENAI_TEXT_MODEL: "test-model",
    OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS: 100,
    OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS: 600,
  }),
}));
vi.mock("@/db/commands/idea-commands", () => ({
  recordIdeaGenerationRun: vi.fn(async () => ({ id: "run-success" })),
  recordFailedIdeaGenerationRun: vi.fn(async () => ({ id: "run-failed" })),
}));

import {
  recordFailedIdeaGenerationRun,
  recordIdeaGenerationRun,
} from "@/db/commands/idea-commands";
import {
  generateIdeas,
  IdeaGenerationRequestError,
} from "@/lib/ideas/generate-ideas";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type {
  IdeaGenerationProviderResult,
  TextGenerationProvider,
} from "@/lib/openai/text-generation-provider";

const idea = {
  topic: "t",
  targetAudience: "a",
  tone: "n",
  targetDurationSeconds: 45,
  primaryPlatform: "tiktok" as const,
  hookAngle: "h",
  rationale: "r",
  hookType: "quick-win",
};

function provider(
  generateIdeas: () => Promise<IdeaGenerationProviderResult>,
): TextGenerationProvider {
  return {
    analyzeScenes: async () => {
      throw new Error("unused");
    },
    generateScript: async () => {
      throw new Error("unused");
    },
    generateTitles: async () => {
      throw new Error("unused");
    },
    generateIdeas,
  };
}

const input = {
  workspaceId: "ws-1",
  userId: "user-1",
  niche: "personal finance",
  platform: null,
  tonePreference: null,
  language: "English",
  count: 5,
};

describe("generateIdeas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a completed run with actual cost and returns the cards", async () => {
    const result = await generateIdeas(
      input,
      provider(async () => ({
        output: { ideas: [idea] },
        requestId: "req-1",
        inputTokens: 800,
        outputTokens: 600,
      })),
    );

    expect(enforceRateLimit).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      operation: "idea_generation",
    });
    expect(result).toEqual({ runId: "run-success", ideas: [idea] });
    // (800 * 100 + 600 * 600) / 1_000_000 = 0.44 -> ceil -> min floor 1.
    expect(recordIdeaGenerationRun).toHaveBeenCalledWith(
      expect.objectContaining({
        actualCostCents: 1,
        resultCount: 1,
        providerRequestId: "req-1",
        promptVersion: "idea-generation-v2",
      }),
    );
    expect(recordFailedIdeaGenerationRun).not.toHaveBeenCalled();
  });

  it("renders the historical-accuracy directive into the recorded prompt for a history niche", async () => {
    await generateIdeas(
      { ...input, niche: "History in short stories" },
      provider(async () => ({
        output: { ideas: [idea] },
        requestId: "req-1",
        inputTokens: 800,
        outputTokens: 600,
      })),
    );

    expect(recordIdeaGenerationRun).toHaveBeenCalledWith(
      expect.objectContaining({
        finalPrompt: expect.stringContaining(
          "Historical accuracy is mandatory",
        ),
      }),
    );
  });

  it("records a failed run and throws a safe error on provider failure", async () => {
    await expect(
      generateIdeas(
        input,
        provider(async () => {
          throw new Error("network down");
        }),
      ),
    ).rejects.toBeInstanceOf(IdeaGenerationRequestError);

    expect(recordFailedIdeaGenerationRun).toHaveBeenCalledWith(
      expect.objectContaining({ category: "provider_error" }),
    );
    expect(recordIdeaGenerationRun).not.toHaveBeenCalled();
  });

  it("does not call the provider when the rate limit is exceeded", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(
      new Error("rate limited"),
    );
    const generate = vi.fn();
    await expect(generateIdeas(input, provider(generate))).rejects.toThrow(
      "rate limited",
    );
    expect(generate).not.toHaveBeenCalled();
    expect(recordIdeaGenerationRun).not.toHaveBeenCalled();
  });
});
