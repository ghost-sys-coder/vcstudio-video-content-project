import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { sceneAnalysisOutputSchema } from "@/lib/schemas/scene";
import { scriptGenerationOutputSchema } from "@/lib/schemas/script-generation";
import { titleGenerationOutputSchema } from "@/lib/schemas/title-generation";
import type { TextGenerationProvider } from "@/lib/openai/text-generation-provider";

export class OpenAiTextGenerationProvider implements TextGenerationProvider {
  private createClient(): OpenAI {
    const environment = getSceneAnalysisEnvironment();
    return new OpenAI({
      apiKey: environment.OPENAI_API_KEY,
      timeout: environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1000,
      maxRetries: 0,
    });
  }

  async analyzeScenes(input: { model: string; prompt: string }) {
    const response = await this.createClient().responses.parse({
      model: input.model,
      input: [
        {
          role: "system",
          content: "Return a faithful, production-ready structured scene plan.",
        },
        { role: "user", content: input.prompt },
      ],
      text: { format: zodTextFormat(sceneAnalysisOutputSchema, "scene_plan") },
    });
    if (!response.output_parsed) throw new Error("OPENAI_INVALID_RESPONSE");
    return {
      output: sceneAnalysisOutputSchema.parse(response.output_parsed),
      requestId: response.id,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }

  async generateScript(input: { model: string; prompt: string }) {
    const response = await this.createClient().responses.parse({
      model: input.model,
      input: [
        {
          role: "system",
          content:
            "You are an expert short-form and long-form video scriptwriter. Return narration-ready copy only.",
        },
        { role: "user", content: input.prompt },
      ],
      text: {
        format: zodTextFormat(scriptGenerationOutputSchema, "generated_script"),
      },
    });
    if (!response.output_parsed) throw new Error("OPENAI_INVALID_RESPONSE");
    return {
      output: scriptGenerationOutputSchema.parse(response.output_parsed),
      requestId: response.id,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }

  async generateTitles(input: { model: string; prompt: string }) {
    const response = await this.createClient().responses.parse({
      model: input.model,
      input: [
        {
          role: "system",
          content:
            "You are an expert video title strategist. Return platform-tuned title options that earn honest clicks.",
        },
        { role: "user", content: input.prompt },
      ],
      text: {
        format: zodTextFormat(titleGenerationOutputSchema, "generated_titles"),
      },
    });
    if (!response.output_parsed) throw new Error("OPENAI_INVALID_RESPONSE");
    return {
      output: titleGenerationOutputSchema.parse(response.output_parsed),
      requestId: response.id,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }
}
