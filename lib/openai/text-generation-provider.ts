import type { SceneAnalysisOutput } from "@/lib/schemas/scene";

export type SceneAnalysisProviderResult = {
  output: SceneAnalysisOutput;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
};

export interface TextGenerationProvider {
  analyzeScenes(input: {
    model: string;
    prompt: string;
  }): Promise<SceneAnalysisProviderResult>;
}
