export class TikTokConnectionError extends Error {
  constructor(
    readonly code: "invalid_sandbox_session" | "invalid_sandbox_credentials",
    message: string,
  ) {
    super(message);
    this.name = "TikTokConnectionError";
  }
}
