import "server-only";

import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import type {
  VideoRenderProvider,
  VideoRenderProviderInput,
  VideoRenderProviderOutput,
} from "@/lib/render/video-render-provider";

/**
 * Concrete Remotion server renderer. This module loads native encoders and a
 * headless Chromium, so it is imported only by the render worker and is kept
 * out of the Next.js bundle (see `serverExternalPackages` in next.config.ts).
 *
 * Bundling happens per render for simplicity in this release; a hot path could
 * cache the serve URL across renders of the same code version.
 */
export class RemotionVideoRenderProvider implements VideoRenderProvider {
  async render(
    input: VideoRenderProviderInput,
  ): Promise<VideoRenderProviderOutput> {
    await ensureBrowser(
      input.chromiumExecutable
        ? { browserExecutable: input.chromiumExecutable }
        : undefined,
    );

    const serveUrl = await bundle({
      entryPoint: input.entryPointPath,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias ?? {}),
            "@": input.aliasRoot,
          },
        },
      }),
    });

    const composition = await selectComposition({
      serveUrl,
      id: input.compositionId,
      inputProps: input.input,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: input.outputFilePath,
      inputProps: input.input,
      crf: input.crf,
      jpegQuality: input.jpegQuality,
      concurrency: input.concurrency,
      timeoutInMilliseconds: input.timeoutMilliseconds,
      browserExecutable: input.chromiumExecutable,
      onProgress: ({ progress }) => input.onProgress?.(progress * 100),
    });

    return {
      outputFilePath: input.outputFilePath,
      renderedFrames: composition.durationInFrames,
    };
  }
}
