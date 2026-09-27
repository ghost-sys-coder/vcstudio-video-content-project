import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createCustomVoice,
  revokeCustomVoice,
} from "@/db/commands/custom-voice-commands";
import { createVoicePreset } from "@/db/commands/voice-preset-commands";
import { listCustomVoices } from "@/db/repositories/custom-voice.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  customVoiceFailureMessage,
  customVoiceFailureStatus,
} from "@/lib/audio/custom-voice-failure-message";
import { isEnrollmentBlocked } from "@/lib/audio/custom-voice-availability";
import { MAX_VOICE_RECORDING_BYTES } from "@/lib/audio/voice-enrollment-requirements";
import { RateLimitExceededError } from "@/lib/domain/errors";
import { can, requireCapability } from "@/lib/policies/workspace-policy";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import {
  customVoiceAudioTypeFromMimeType,
  customVoiceEnrollmentSchema,
} from "@/lib/schemas/scene-audio";
import {
  configuredEnrollmentProviderId,
  createVoiceEnrollmentProvider,
  type EnrolledVoice,
  type VoiceEnrollmentProvider,
} from "@/lib/speech/voice-enrollment-provider";

export const maxDuration = 60;

/**
 * The provider new voices go to: whatever the deployment narrates with. A
 * zero-shot provider keeps no voice, so it yields none and enrolment reports
 * itself unsupported instead of quietly falling back to OpenAI.
 */
function enrollmentProvider(): VoiceEnrollmentProvider | null {
  const id = configuredEnrollmentProviderId();
  return id ? createVoiceEnrollmentProvider(id) : null;
}

const UNSUPPORTED_AVAILABILITY = {
  status: "unsupported" as const,
  detail:
    "The configured speech provider does not enrol voices. Set SPEECH_PROVIDER to gemini or openai to clone a voice.",
};

function validRecording(value: FormDataEntryValue | null): value is File {
  return (
    value instanceof File &&
    value.size > 0 &&
    value.size <= MAX_VOICE_RECORDING_BYTES &&
    customVoiceAudioTypeFromMimeType(value.type) !== null
  );
}

/**
 * Reports enrollment capability alongside the workspace's voices so the UI can
 * refuse to collect recordings the provider cannot accept.
 */
export async function GET() {
  const authentication = await auth();
  if (!authentication.userId)
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  const context = await getAuthenticatedWorkspaceContext();
  if (!context)
    return NextResponse.json(
      { error: "Workspace access is required." },
      { status: 403 },
    );

  const voices = await listCustomVoices({
    workspaceId: context.activeMembership.workspaceId,
  });
  const canManage = can(context.activeMembership.role, "manageCustomVoices");
  const provider = canManage ? enrollmentProvider() : null;
  const availability = !canManage
    ? { status: "unknown" as const, detail: "" }
    : provider
      ? await provider.checkAvailability()
      : UNSUPPORTED_AVAILABILITY;

  return NextResponse.json({
    availability,
    enrollment: provider?.details ?? null,
    canManage,
    voices: voices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      consentLanguage: voice.consentLanguage,
      status: voice.status,
      createdAt: voice.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const authentication = await auth();
  if (!authentication.userId)
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );

  let workspaceId: string;
  let userId: string;
  let name: string;
  let language: string;
  let consentRecording: File;
  let voiceSample: File;
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return NextResponse.json(
        { error: "Workspace access is required." },
        { status: 403 },
      );
    requireCapability(context.activeMembership.role, "manageCustomVoices");
    workspaceId = context.activeMembership.workspaceId;
    userId = context.user.id;

    const formData = await request.formData();
    const parsed = customVoiceEnrollmentSchema.safeParse({
      name: formData.get("name"),
      language: formData.get("language"),
    });
    if (!parsed.success)
      return NextResponse.json(
        { error: "Provide a voice name and supported consent language." },
        { status: 400 },
      );
    const consent = formData.get("consentRecording");
    const sample = formData.get("voiceSample");
    if (!validRecording(consent))
      return NextResponse.json(
        {
          error:
            "The consent recording is empty, larger than 10 MiB, or uses an unsupported audio format.",
        },
        { status: 400 },
      );
    if (!validRecording(sample))
      return NextResponse.json(
        {
          error:
            "The voice sample is empty, larger than 10 MiB, or uses an unsupported audio format.",
        },
        { status: 400 },
      );
    name = parsed.data.name;
    language = parsed.data.language;
    consentRecording = consent;
    voiceSample = sample;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "WorkspacePermissionDeniedError"
    )
      return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

  try {
    await enforceRateLimit({
      workspaceId,
      operation: "custom_voice_enrollment",
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError)
      return NextResponse.json({ error: error.message }, { status: 429 });
    throw error;
  }

  const provider = enrollmentProvider();
  if (!provider)
    return NextResponse.json(
      {
        availability: UNSUPPORTED_AVAILABILITY,
        error: `${UNSUPPORTED_AVAILABILITY.detail} Your recordings were fine — nothing was sent to a provider.`,
      },
      { status: 503 },
    );

  // Checked before either recording is uploaded: when the provider has no
  // custom-voice endpoints, an enrollment attempt fails in a way that reads as
  // a rejected recording, which is the confusion this route exists to avoid.
  const availability = await provider.checkAvailability();
  if (isEnrollmentBlocked(availability))
    return NextResponse.json(
      {
        availability,
        error: `${availability.detail} Your recordings were fine — nothing was sent to the provider.`,
      },
      { status: 503 },
    );

  let enrolled: EnrolledVoice;
  try {
    enrolled = await provider.enroll({
      name,
      language,
      consent: consentRecording,
      sample: voiceSample,
    });
  } catch (error) {
    console.error("Custom voice enrollment failed", {
      provider: provider.details.provider,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: customVoiceFailureMessage(error) },
      { status: customVoiceFailureStatus(error) },
    );
  }

  try {
    const customVoice = await createCustomVoice({
      workspaceId,
      name,
      provider: provider.details.provider,
      providerVoiceId: enrolled.providerVoiceId,
      providerConsentId: enrolled.providerConsentId,
      consentLanguage: language,
      createdByUserId: userId,
    });
    try {
      await createVoicePreset({
        workspaceId,
        createdByUserId: userId,
        name,
        provider: provider.details.provider,
        voice: enrolled.providerVoiceId,
        model: provider.preset.model,
        instructions: "",
        speedScaledPercent: 100,
        format: provider.preset.format,
        isDefault: false,
        customVoiceId: customVoice.id,
      });
    } catch (error) {
      await revokeCustomVoice({
        workspaceId,
        customVoiceId: customVoice.id,
        revokedByUserId: userId,
      }).catch(() => undefined);
      throw error;
    }
    await recordAuditEvent({
      workspaceId,
      actorUserId: userId,
      action: "custom_voice_created",
      targetType: "custom_voice",
      targetId: customVoice.id,
      metadata: {
        consentLanguage: language,
        provider: provider.details.provider,
      },
    });
    return NextResponse.json({ success: true, customVoiceId: customVoice.id });
  } catch (error) {
    // The provider holds a voice this workspace cannot see; forget it there.
    await provider.discard(enrolled).catch(() => undefined);
    console.error("Custom voice could not be saved", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: customVoiceFailureMessage(error) },
      { status: customVoiceFailureStatus(error) },
    );
  }
}
