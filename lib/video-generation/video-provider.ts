import type {
  VideoGenerationRequest,
  VideoModelDescriptor,
} from "@studio/contracts/video";

export type VideoProviderAsset = {
  role: VideoGenerationRequest["inputs"][number]["role"];
  contentType: string;
  bytes: Buffer;
};
export type VideoProviderOutput =
  { kind: "uri"; uri: string } | { kind: "inline"; bytes: Buffer };
export type VideoProviderState =
  | { status: "running"; jobId: string; requestId: string | null }
  | {
      status: "succeeded";
      jobId: string;
      requestId: string | null;
      output: VideoProviderOutput;
      usage: {
        inputTokens: number;
        outputTokens: number;
        videoTokens: number;
        thoughtTokens: number;
        creditsCharged?: number;
        unknownOutputTokens?: number;
      } | null;
    }
  | {
      status: "failed";
      jobId: string;
      requestId: string | null;
      code: string;
      safeMessage: string;
    };
export interface VideoProvider {
  start(input: {
    request: VideoGenerationRequest;
    model: VideoModelDescriptor;
    finalPrompt: string;
    assets: VideoProviderAsset[];
  }): Promise<VideoProviderState>;
  check(jobId: string): Promise<VideoProviderState>;
  cancel?(jobId: string): Promise<void>;
  download(uri: string): Promise<Buffer>;
}
export class VideoProviderError extends Error {
  constructor(
    readonly code: string,
    readonly definitelyUnbilled: boolean,
    readonly requestId: string | null = null,
  ) {
    super(
      definitelyUnbilled
        ? "The provider rejected this request before generation. Check access and configuration."
        : "The provider result is uncertain. Funds remain reserved; resume the existing job instead of submitting another.",
    );
    this.name = "VideoProviderError";
  }
}
