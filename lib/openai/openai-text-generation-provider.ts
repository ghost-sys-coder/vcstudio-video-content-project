import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { sceneAnalysisOutputSchema } from "@/lib/schemas/scene";
import type { TextGenerationProvider } from "@/lib/openai/text-generation-provider";

export class OpenAiTextGenerationProvider implements TextGenerationProvider {
  async analyzeScenes(input: { model: string; prompt: string }) {
    const environment = getSceneAnalysisEnvironment();
    const client = new OpenAI({
      apiKey: environment.OPENAI_API_KEY,
      timeout: environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1000,
      maxRetries: 0,
    });
    const response = await client.responses.parse({
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
}
