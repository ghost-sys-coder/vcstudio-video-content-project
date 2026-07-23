import type { IdeaGenerationOutput } from "@/lib/schemas/idea-generation";
import type { SceneAnalysisOutput } from "@/lib/schemas/scene";
import type { ScriptGenerationOutput } from "@/lib/schemas/script-generation";
import type { TitleGenerationOutput } from "@/lib/schemas/title-generation";

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

export type TitleGenerationProviderResult = {
  output: TitleGenerationOutput;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
};

export type IdeaGenerationProviderResult = {
  output: IdeaGenerationOutput;
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
  generateTitles(input: {
    model: string;
    prompt: string;
  }): Promise<TitleGenerationProviderResult>;
  generateIdeas(input: {
    model: string;
    prompt: string;
  }): Promise<IdeaGenerationProviderResult>;
}
