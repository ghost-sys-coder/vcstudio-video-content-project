/**
 * The one shape every video model is reached through.
 *
 * **Why a gateway rather than an integration per vendor.** Video models arrive
 * and change monthly, and the parts that differ between them are almost all
 * accidental: the name of the field that carries the starting image, whether
 * the length is called `duration` or `num_frames`, whether the result comes
 * back inline or behind a URL. The parts that matter to this application are
 * the same everywhere. A vendor adapter's whole job is to translate one into
 * the other, so that adding a model becomes configuration rather than code.
 *
 * **Why it is deliberately narrow.** `AGENTS.md` warns against building a
 * universal provider framework, and it is right: a gateway that tries to expose
 * every knob every vendor has ends up as a second API surface nobody
 * understands. This exposes exactly what a scene needs, which is a starting
 * image, a description of the motion, a shape, a length and a ceiling on size.
 *
 * **Why generation is two calls rather than one.** Every one of these models
 * takes tens of seconds to minutes, far longer than a request may last. So a
 * provider starts a job and reports where it got to, and the worker polls. A
 * provider that happens to answer immediately simply returns a finished status
 * on the first call.
 */

import type {
  VideoAspectRatio,
  VideoGenerationMode,
} from "@/lib/video-models/video-model-capabilities";

export interface VideoGenerationRequest {
  /** The vendor's own identifier for the model, carried opaquely. */
  modelSlug: string;
  mode: VideoGenerationMode;
  /** The motion to perform. Never the scene's content: that is in the image. */
  prompt: string;
  /** What not to do. Empty when the vendor has no such field. */
  negativePrompt: string;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  resolutionHeight: number;
  /**
   * The approved still to animate, required for `imageToVideo` and absent
   * otherwise. Bytes rather than a URL so no signed URL is handed to a third
   * party, and so the caller controls what leaves storage.
   */
  startImage?: {
    bytes: Uint8Array;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
  };
  /**
   * Makes a repeat request resolve to the earlier job instead of starting a
   * second paid one, wherever the vendor supports it.
   */
  idempotencyKey: string;
}

export interface VideoGenerationJob {
  /** The vendor's handle for the running job, stored so polling survives a lost worker. */
  providerJobId: string;
  /** Present when the vendor gives one, for support conversations. */
  providerRequestId: string | null;
}

export type VideoGenerationStatus =
  | { state: "running"; progressPercent: number | null }
  | {
      state: "succeeded";
      mimeType: string;
      durationMilliseconds: number | null;
      width: number | null;
      height: number | null;
      /**
       * What the vendor says it charged. Null when it says nothing, in which
       * case the estimate stands as the recorded cost rather than a guess
       * dressed as a measurement.
       */
      actualCostCents: number | null;
    }
  | { state: "failed"; code: string; retriable: boolean };

/** Thrown for transport and protocol failures, never for a job that simply failed. */
export class VideoGenerationProviderError extends Error {
  readonly code: string;
  readonly retriable: boolean;
  readonly providerRequestId: string | null;

  constructor(input: {
    code: string;
    retriable: boolean;
    providerRequestId?: string | null;
  }) {
    super(input.code);
    this.name = "VideoGenerationProviderError";
    this.code = input.code;
    this.retriable = input.retriable;
    this.providerRequestId = input.providerRequestId ?? null;
  }
}

export interface VideoGenerationProvider {
  /** Stored on the generation row, so a clip can always be traced to its source. */
  readonly providerKey: string;
  start(request: VideoGenerationRequest): Promise<VideoGenerationJob>;
  check(job: VideoGenerationJob): Promise<VideoGenerationStatus>;
  /**
   * The finished clip's bytes.
   *
   * Separate from `check` because vendors genuinely differ here and pretending
   * otherwise forced a lie into the contract: some hand back a short-lived URL,
   * OpenAI streams the file from an endpoint of its own. Asking the adapter for
   * bytes lets each do what it does, and keeps signed URLs and vendor tokens
   * from leaking into the rest of the application.
   */
  download(
    job: VideoGenerationJob,
  ): Promise<{ bytes: Uint8Array; mimeType: string }>;
}
