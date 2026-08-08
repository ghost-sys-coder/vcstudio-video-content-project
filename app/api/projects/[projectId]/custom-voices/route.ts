import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCustomVoice,
  revokeCustomVoice,
} from "@/db/commands/custom-voice-commands";
import { createVoicePreset } from "@/db/commands/voice-preset-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import { OpenAiCustomVoiceProvider } from "@/lib/openai/custom-voice-provider";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import {
  customVoiceAudioTypeFromMimeType,
  customVoiceEnrollmentSchema,
} from "@/lib/schemas/scene-audio";

const paramsSchema = z.object({ projectId: z.uuid() });
const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const maxDuration = 60;

function validRecording(value: FormDataEntryValue | null): value is File {
  return (
    value instanceof File &&
    value.size > 0 &&
    value.size <= MAX_FILE_BYTES &&
    customVoiceAudioTypeFromMimeType(value.type) !== null
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
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
      { error: "The project is invalid." },
      { status: 400 },
    );

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return NextResponse.json(
        { error: "Workspace access is required." },
        { status: 403 },
      );
    requireCapability(
      workspaceContext.activeMembership.role,
      "manageCustomVoices",
    );
    const workspaceId = workspaceContext.activeMembership.workspaceId;
    const project = await findProject({
      workspaceId,
      projectId: parsedParams.data.projectId,
    });
    if (!project || project.status === "archived")
      return NextResponse.json(
        { error: "The project is unavailable." },
        { status: 404 },
      );

    const formData = await request.formData();
    const parsed = customVoiceEnrollmentSchema.safeParse({
      name: formData.get("name"),
      language: formData.get("language"),
    });
    const consentRecording = formData.get("consentRecording");
    const voiceSample = formData.get("voiceSample");
    if (!parsed.success)
      return NextResponse.json(
        { error: "Provide a voice name and supported consent language." },
        { status: 400 },
      );
    if (!validRecording(consentRecording))
      return NextResponse.json(
        {
          error:
            "The consent recording is empty, larger than 10 MiB, or uses an unsupported audio format.",
        },
        { status: 400 },
      );
    if (!validRecording(voiceSample))
      return NextResponse.json(
        {
          error:
            "The voice sample is empty, larger than 10 MiB, or uses an unsupported audio format.",
        },
        { status: 400 },
      );

    await enforceRateLimit({
      workspaceId,
      operation: "custom_voice_enrollment",
    });

    const environment = getSceneAudioEnvironment();
    const provider = new OpenAiCustomVoiceProvider({
      apiKey: environment.OPENAI_API_KEY,
    });
    const consentId = await provider.createConsent({
      name: `${parsed.data.name} consent`,
      language: parsed.data.language,
      recording: consentRecording,
    });
    let providerVoiceId: string;
    try {
      providerVoiceId = await provider.createVoice({
        name: parsed.data.name,
        consentId,
        sample: voiceSample,
      });
    } catch (error) {
      await provider.deleteConsent(consentId).catch(() => undefined);
      throw error;
    }
    let customVoice;
    try {
      customVoice = await createCustomVoice({
        workspaceId,
        name: parsed.data.name,
        providerVoiceId,
        providerConsentId: consentId,
        consentLanguage: parsed.data.language,
        createdByUserId: workspaceContext.user.id,
      });
      await createVoicePreset({
        workspaceId,
        createdByUserId: workspaceContext.user.id,
        name: parsed.data.name,
        voice: providerVoiceId,
        model: environment.OPENAI_TTS_MODEL,
        instructions: "",
        speedScaledPercent: 100,
        format: environment.OPENAI_TTS_FORMAT,
        isDefault: false,
        customVoiceId: customVoice.id,
      });
    } catch (error) {
      await provider.deleteConsent(consentId).catch(() => undefined);
      if (customVoice)
        await revokeCustomVoice({
          workspaceId,
          customVoiceId: customVoice.id,
          revokedByUserId: workspaceContext.user.id,
        }).catch(() => undefined);
      throw error;
    }
    await recordAuditEvent({
      workspaceId,
      actorUserId: workspaceContext.user.id,
      action: "custom_voice_created",
      targetType: "custom_voice",
      targetId: customVoice.id,
      metadata: { consentLanguage: parsed.data.language },
    });
    return NextResponse.json({ success: true, customVoiceId: customVoice.id });
  } catch (error) {
    console.error("Custom voice enrollment failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      {
        error:
          "The custom voice could not be created. Verify the consent phrase and recording quality, then try again.",
      },
      { status: 502 },
    );
  }
}
