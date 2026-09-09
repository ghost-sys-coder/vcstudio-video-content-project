import { config as loadEnvironment } from "dotenv";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderSceneAnalysisPrompt } from "@studio/prompts";
import { checkNarrationCoverage } from "@/lib/domain/narration-coverage";
import { generateValidatedScenePlan } from "@/lib/scenes/generate-validated-scene-plan";

/**
 * Opt-in live provider check. Costs real OpenAI credit, so it is gated the same
 * way the PostgreSQL suites are:
 *
 *   RUN_LIVE_PROVIDER_TESTS=true npx vitest run lib/scenes/scene-analysis-live-provider.test.ts
 *
 * This exists to answer the one question unit tests cannot: does a real model,
 * given the v2 prompt, produce narration that survives the fidelity validator?
 * The expensive failure mode is a *false rejection* — the validator refusing a
 * plan that is editorially fine because the model normalized an apostrophe or a
 * dash. Unit tests prove the validator rejects corruption; only this proves it
 * does not reject ordinary, correct output.
 */
const enabled = process.env.RUN_LIVE_PROVIDER_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeLive = enabled ? describe.sequential : describe.skip;

const PLAIN_SCRIPT = `Compound interest is the quietest force in personal finance.
For the first few years it looks like nothing is happening at all.
Then the curve bends, and the money you never touched starts doing the work.
The people who win are rarely the smartest. They are the ones who started early and left it alone.`;

// Deliberately loaded with the characters a model is most tempted to "tidy":
// a curly apostrophe, an em dash, a percentage, a quoted phrase and a decimal.
const TYPOGRAPHIC_SCRIPT = `Here's the part nobody tells you — fees compound too.
A 1.5% annual fee doesn't sound like much on a $10,000 balance.
Over thirty years it can quietly eat a third of your "safe" retirement pot.
So read the fine print, and ask what you're actually paying for.`;

async function analyze(script: string) {
  const { OpenAiTextGenerationProvider } =
    await import("@/lib/openai/openai-text-generation-provider");
  const { getSceneAnalysisEnvironment } = await import("@/lib/env/server");
  const environment = getSceneAnalysisEnvironment();
  const prompt = renderSceneAnalysisPrompt({
    script,
    maximumScenes: environment.MAX_SCENES_PER_PROJECT,
    aspectRatio: "16:9",
    language: "en",
  });
  return generateValidatedScenePlan({
    provider: new OpenAiTextGenerationProvider(),
    model: environment.OPENAI_TEXT_MODEL,
    initialPrompt: prompt,
    approvedScript: script,
    maximumScenes: environment.MAX_SCENES_PER_PROJECT,
    aspectRatio: "16:9",
    language: "en",
  });
}

function report(script: string, narrations: string[]): string {
  const coverage = checkNarrationCoverage({
    approvedScript: script,
    sceneNarrations: narrations,
  });
  if (coverage.ok) return "covered";
  return JSON.stringify(coverage.discrepancies[0], null, 2);
}

describeLive("scene analysis against the live provider", () => {
  it(
    "produces a plan that passes fidelity validation on plain prose",
    { timeout: 300_000 },
    async () => {
      const result = await analyze(PLAIN_SCRIPT);
      const narrations = result.ok
        ? result.output.scenes.map((scene) => scene.narrationText)
        : [];
      console.log(
        `[plain] ok=${result.ok} attempts=${result.usage.attempts} ` +
          `tokens=${result.usage.inputTokens}/${result.usage.outputTokens} ` +
          `scenes=${narrations.length}`,
      );
      if (!result.ok)
        console.log(
          "[plain] discrepancy:",
          JSON.stringify(result.coverage.discrepancies[0], null, 2),
        );
      else console.log("[plain] recheck:", report(PLAIN_SCRIPT, narrations));
      expect(result.ok).toBe(true);
    },
  );

  it(
    "survives typographic punctuation a model is tempted to normalize",
    { timeout: 300_000 },
    async () => {
      const result = await analyze(TYPOGRAPHIC_SCRIPT);
      console.log(
        `[typographic] ok=${result.ok} attempts=${result.usage.attempts} ` +
          `tokens=${result.usage.inputTokens}/${result.usage.outputTokens}`,
      );
      if (!result.ok)
        console.log(
          "[typographic] discrepancy:",
          JSON.stringify(result.coverage.discrepancies[0], null, 2),
        );
      expect(result.ok).toBe(true);
    },
  );
});
