import type {
  AudioGenerationStatus,
  AudioReviewStatus,
  SceneStatus,
} from "@/db/schema";
import type { SceneAudioFormat } from "@/lib/schemas/scene-audio";

export type SceneAudioEligibility =
  | "eligible"
  | "hasApprovedAudio"
  | "inProgress"
  | "notApproved"
  | "noNarration";

export interface VoicePresetView {
  id: string;
  name: string;
  voice: string;
  model: string;
  instructions: string;
  speedScaledPercent: number;
  format: SceneAudioFormat;
  isDefault: boolean;
}

export interface AudioSceneView {
  sceneId: string;
  sceneNumber: number;
  sceneStatus: SceneStatus;
  sceneVersionId: string;
  narrationPreview: string;
  characterCount: number;
  eligibility: SceneAudioEligibility;
  latestGenerationId: string | null;
  latestStatus: AudioGenerationStatus | null;
  latestReviewStatus: AudioReviewStatus | null;
  latestGenerationVersion: number | null;
  progressPercent: number;
  audioUrl: string | null;
  approvedAudioUrl: string | null;
  durationMilliseconds: number | null;
  estimatedCostCents: number | null;
  actualCostCents: number | null;
  safeErrorMessage: string | null;
}

export interface AudioTimelineSceneView {
  sceneId: string;
  sceneNumber: number;
  startMilliseconds: number;
  endMilliseconds: number;
  startFrame: number;
  endFrame: number;
  durationMilliseconds: number;
  hasApprovedAudio: boolean;
}

export interface AudioTimelineView {
  scenes: AudioTimelineSceneView[];
  framesPerSecond: number;
  paddingMilliseconds: number;
  totalDurationMilliseconds: number;
  totalFrames: number;
  scenesWithApprovedAudio: number;
  totalScenes: number;
}

export interface AudioConfigurationView {
  enabled: boolean;
  maximumScenesPerBatch: number;
  costPerMillionCharactersCents: number;
  minimumEstimateCents: number;
  defaultFormat: SceneAudioFormat;
}

export interface AudioProgressCounts {
  total: number;
  pending: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}

export interface AudioWorkspaceView {
  scenes: AudioSceneView[];
  voicePresets: VoicePresetView[];
  timeline: AudioTimelineView;
  configuration: AudioConfigurationView;
  availableBudgetCents: number;
  progress: AudioProgressCounts;
}

export type AudioWorkspaceResponse =
  | { success: true; data: AudioWorkspaceView }
  | { success: false; error: string };

export interface SceneAudioActionResult {
  success: boolean;
  error: string | null;
}

export interface AudioGenerateInput {
  sceneIds: string[];
  voicePresetId: string;
}

export type AudioGenerateHandler = (
  input: AudioGenerateInput,
) => Promise<SceneAudioActionResult>;

export type AudioReviewHandler = (
  generationId: string,
) => Promise<SceneAudioActionResult>;
