import { NextResponse } from "next/server";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { listElevenLabsVoices } from "@/lib/elevenlabs/voices";
import {
  elevenLabsStatus,
  ElevenLabsUnavailableError,
} from "@/lib/elevenlabs/configuration";
export async function GET(request: Request) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context)
    return NextResponse.json(
      { error: "Sign in to your workspace." },
      { status: 401 },
    );
  try {
    requireCapability(context.activeMembership.role, "manageVoicePresets");
    const result = await listElevenLabsVoices(
      new URL(request.url).searchParams.get("cursor") ?? undefined,
    );
    return NextResponse.json(
      { ...result, model: elevenLabsStatus().voice.model },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ElevenLabsUnavailableError
            ? error.message
            : "ElevenLabs voices could not be loaded. Check access and key permissions.",
      },
      { status: 403 },
    );
  }
}
