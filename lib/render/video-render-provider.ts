import type { ValidatedVideoCompositionInput } from "@/lib/render/render-composition-input";

export interface VideoRenderProviderInput {
  /** Absolute path to the Remotion entry that calls registerRoot. */
  entryPointPath: string;
  /** Directory used to resolve the "@/" import alias in the bundle. */
  aliasRoot: string;
  compositionId: string;
  input: ValidatedVideoCompositionInput;
  /** Absolute path the encoded MP4 is written to. */
  outputFilePath: string;
  crf: number;
  jpegQuality: number;
  concurrency: number;
  timeoutMilliseconds: number;
  chromiumExecutable?: string;
  onProgress?: (progressPercent: number) => void;
}

export interface VideoRenderProviderOutput {
  outputFilePath: string;
  renderedFrames: number;
}

/**
 * Narrow rendering boundary. The web app and tests depend only on this
 * interface; the concrete Remotion implementation (which loads a headless
 * Chromium and native encoders) is imported solely by the render worker.
 */
export interface VideoRenderProvider {
  render(input: VideoRenderProviderInput): Promise<VideoRenderProviderOutput>;
}
