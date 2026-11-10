/** Safe errors contain no raw provider response, URLs or credentials. */
export class ElevenLabsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElevenLabsUnavailableError";
  }
}
export class ElevenLabsPresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElevenLabsPresetError";
  }
}
export class ElevenLabsApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly requestId: string | null = null,
  ) {
    super(
      status === 402
        ? "ElevenLabs image/video API access requires Pro or higher."
        : status === 401 || status === 403
          ? "Check the ElevenLabs key permissions and subscription access."
          : "ElevenLabs could not complete this request. Inspect the existing operation before retrying.",
    );
    this.name = "ElevenLabsApiError";
  }
}
export class ElevenLabsImageError extends Error {
  constructor(
    readonly jobId: string | null,
    readonly definitelyUnbilled: boolean,
    message: string,
  ) {
    super(message);
    this.name = "ElevenLabsImageError";
  }
}
