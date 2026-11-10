import "server-only";
import { boundedResponseBytes } from "@/lib/video-generation/providers/provider-http";
import { ElevenLabsApiError } from "./errors";
import { z } from "zod";
import { requireElevenLabs, ElevenLabsUnavailableError } from "./configuration";

export { ElevenLabsApiError } from "./errors";
export async function elevenLabsJson(path: string, body?: unknown) {
  const env = requireElevenLabs(path.startsWith("/v1/flows/"));
  let response: Response;
  try {
    response = await fetch(`https://api.elevenlabs.io${path}`, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "xi-api-key": env.ELEVEN_LABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new ElevenLabsApiError(null);
  }
  if (!response.ok)
    throw new ElevenLabsApiError(
      response.status,
      response.headers.get("request-id"),
    );
  const text = (await boundedResponseBytes(response, 2000000)).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ElevenLabsApiError(null);
  }
}
export async function assertElevenLabsVisualPlan() {
  requireElevenLabs(true);
  const subscription = z
    .object({ tier: z.string(), status: z.string() })
    .parse(await elevenLabsJson("/v1/user/subscription"));
  if (
    !["pro", "scale", "business", "enterprise"].includes(
      subscription.tier.toLowerCase(),
    ) ||
    subscription.status !== "active"
  )
    throw new ElevenLabsUnavailableError(
      "ElevenLabs image/video API access requires an active Pro or higher subscription. No generation was submitted.",
    );
}
export const elevenLabsMediaStateSchema = z.discriminatedUnion("status", [
  z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    status: z.enum(["pending", "generating"]),
  }),
  z.object({
    id: z.string(),
    status: z.literal("completed"),
    content_url: z.url(),
    content_mime_type: z.string(),
  }),
  z.object({
    id: z.string(),
    status: z.literal("failed"),
    failure_reason: z.enum([
      "timeout",
      "model_error",
      "moderated",
      "invalid_parameters",
      "dependency_failed",
      "charging_failed",
      "internal_error",
    ]),
  }),
]);
export async function startElevenLabsMedia(
  kind: "image" | "video",
  body: unknown,
) {
  try {
    await assertElevenLabsVisualPlan();
  } catch (error) {
    if (error instanceof ElevenLabsUnavailableError) throw error;
    throw new ElevenLabsUnavailableError(
      "ElevenLabs visual account eligibility could not be verified. No generation was submitted.",
    );
  }
  return z
    .object({
      id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
      status: z.literal("pending"),
    })
    .parse(await elevenLabsJson(`/v1/flows/${kind}`, body));
}
export async function getElevenLabsMedia(kind: "image" | "video", id: string) {
  const safeId = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,120}$/)
    .parse(id);
  const state = elevenLabsMediaStateSchema.parse(
    await elevenLabsJson(`/v1/flows/${kind}/${safeId}`),
  );
  if (state.id !== id) throw new ElevenLabsApiError(null);
  return state;
}
