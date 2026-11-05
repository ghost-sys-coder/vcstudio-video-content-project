import "server-only";
import { ZodError } from "zod";
import { VideoOperationError } from "@/db/commands/video-generation-commands";
import { InvalidVideoQuoteError } from "./video-generation-quote";
import { VideoRequestNotSupportedError } from "./plan-video-generation";
export async function videoActionResult<T>(
  run: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof ZodError)
      return {
        ok: false,
        error: error.issues[0]?.message ?? "Check the video settings.",
      };
    if (
      error instanceof VideoOperationError ||
      error instanceof InvalidVideoQuoteError ||
      error instanceof VideoRequestNotSupportedError
    )
      return { ok: false, error: error.message };
    console.error("Video action failed", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return {
      ok: false,
      error:
        "This video request could not be completed. Check your workspace access and try again.",
    };
  }
}
