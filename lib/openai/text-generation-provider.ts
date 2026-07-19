import type { SceneAnalysisOutput } from "@/lib/schemas/scene";
import type { ScriptGenerationOutput } from "@/lib/schemas/script-generation";

export type SceneAnalysisProviderResult = {
  output: SceneAnalysisOutput;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
};

export type ScriptGenerationProviderResult = {
  output: ScriptGenerationOutput;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
};

export interface TextGenerationProvider {
  analyzeScenes(input: {
    model: string;
    prompt: string;
  }): Promise<SceneAnalysisProviderResult>;
  generateScript(input: {
    model: string;
    prompt: string;
  }): Promise<ScriptGenerationProviderResult>;
}
