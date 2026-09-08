import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeCustomVoice } from "@/db/commands/custom-voice-commands";
import { findActiveCustomVoice } from "@/db/repositories/custom-voice.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import { OpenAiCustomVoiceProvider } from "@/lib/openai/custom-voice-provider";
import { requireCapability } from "@/lib/policies/workspace-policy";

const paramsSchema = z.object({ customVoiceId: z.uuid() });

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ customVoiceId: string }> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json(
      { error: "The custom voice is invalid." },
      { status: 400 },
    );

  const workspaceContext = await getAuthenticatedWorkspaceContext();
  if (!workspaceContext)
    return NextResponse.json(
      { error: "Workspace access is required." },
      { status: 403 },
    );
  try {
    requireCapability(
      workspaceContext.activeMembership.role,
      "manageCustomVoices",
    );
  } catch {
    return NextResponse.json(
      { error: "Your workspace role does not permit this action." },
      { status: 403 },
    );
  }

  const workspaceId = workspaceContext.activeMembership.workspaceId;
  const customVoice = await findActiveCustomVoice({
    workspaceId,
    customVoiceId: parsedParams.data.customVoiceId,
  });
  if (!customVoice)
    return NextResponse.json(
      { error: "This custom voice is no longer active." },
      { status: 404 },
    );

  // Provider consent is deleted first: local revocation without it would leave
  // a consent record the workspace can no longer see or remove.
  await new OpenAiCustomVoiceProvider({
    apiKey: getSceneAudioEnvironment().OPENAI_API_KEY,
  })
    .deleteConsent(customVoice.providerConsentId)
    .catch(() => undefined);

  await revokeCustomVoice({
    workspaceId,
    customVoiceId: customVoice.id,
    revokedByUserId: workspaceContext.user.id,
  });
  await recordAuditEvent({
    workspaceId,
    actorUserId: workspaceContext.user.id,
    action: "custom_voice_revoked",
    targetType: "custom_voice",
    targetId: customVoice.id,
    metadata: {},
  });
  return NextResponse.json({ success: true });
}
