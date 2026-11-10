import type { SceneImageProviderConfiguration } from "@/lib/schemas/scene-image";

export type SceneImageGenerationPlan = {
  configuration: SceneImageProviderConfiguration;
  estimatedCostCents: number;
  sceneVersionId: string;
  promptTemplateVersion: string;
  referenceAssetIds: string[];
  referenceRevisions: Array<{ id: string; etag: string | null }>;
};
export type SceneAudioGenerationPlan = {
  sceneId: string;
  sceneVersionId: string;
  sceneVersion: number;
  text: string;
  instructions: string;
  provider: string;
  model: string;
  voice: string;
  format: string;
  speedScaledPercent: number;
  estimatedCostCents: number;
};
