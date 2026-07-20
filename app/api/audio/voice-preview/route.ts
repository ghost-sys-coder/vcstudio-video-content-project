import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  getVoicePreviewAudio,
  UnknownPreviewVoiceError,
} from "@/lib/audio/voice-preview";
import { voicePreviewVoiceSchema } from "@/lib/audio/voice-catalog";

function empty(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Streams a short clip of the requested voice reading the fixed sample line so
 * users can audition voices on the audio page. Requires an authenticated
 * workspace member; the underlying clip is a cached, cost-bounded system asset.
 */
export async function GET(request: Request) {
  const authentication = await auth();
  if (!authentication.userId) return empty(401);

  const workspaceContext = await getAuthenticatedWorkspaceContext();
  if (!workspaceContext) return empty(403);

  const parsed = voicePreviewVoiceSchema.safeParse(
    new URL(request.url).searchParams.get("voice"),
  );
  if (!parsed.success) return empty(400);

  try {
    const preview = await getVoicePreviewAudio({ voice: parsed.data });
    return new NextResponse(new Uint8Array(preview.bytes), {
      status: 200,
      headers: {
        "Content-Type": preview.contentType,
        "Content-Length": String(preview.bytes.byteLength),
        // Safe to cache in the browser: the clip for a given voice is immutable.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof UnknownPreviewVoiceError) return empty(400);
    console.error("Voice preview failed.", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return empty(502);
  }
}
