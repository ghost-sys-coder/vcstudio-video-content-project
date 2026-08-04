"use server";

import { revalidatePath } from "next/cache";
import {
  deleteBrandAudience,
  deleteBrandOffer,
  ensureBrandProfile,
  saveOnboardingAnswers,
  updateBrandProfile,
  updateBrandVoice,
  upsertBrandAudience,
  upsertBrandOffer,
} from "@/db/commands/marketing-brand-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getMarketingEnvironment } from "@/lib/env/server";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";
import { calculateBrandCompleteness } from "@/lib/marketing/brand/brand-completeness";
import { ONBOARDING_QUESTIONS } from "@/lib/marketing/brand/onboarding-questions";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  brandAudienceSchema,
  brandOfferSchema,
  brandProfileSchema,
  brandVoiceSchema,
  deleteBrandEntitySchema,
  readBrandAudienceForm,
  readBrandOfferForm,
  saveOnboardingAnswersSchema,
} from "@/lib/schemas/marketing-brand";

export type BrandActionResult = { ok: true } | { ok: false; error: string };

/**
 * Resolves an authorised, profile-backed context for every brand mutation.
 *
 * Every action needs the same four things — the flag, the workspace, the
 * capability, and a profile row that audiences and offers can hang off — so
 * they are resolved once here rather than repeated five times with a chance of
 * one of them being forgotten.
 */
async function resolveBrandContext() {
  if (!getMarketingEnvironment().ENABLE_MARKETING_STUDIO)
    return {
      ok: false as const,
      error: "The Marketing Studio is not enabled.",
    };

  const context = await getAuthenticatedWorkspaceContext();
  if (!context)
    return { ok: false as const, error: "Workspace context is unavailable." };

  requireCapability(context.activeMembership.role, "manageBrandProfile");

  const profile = await ensureBrandProfile({
    workspaceId: context.activeMembership.workspaceId,
    userId: context.user.id,
  });

  return {
    ok: true as const,
    workspaceId: context.activeMembership.workspaceId,
    userId: context.user.id,
    profileId: profile.id,
  };
}

function revalidateBrand(): void {
  revalidatePath("/app/marketing");
  revalidatePath("/app/marketing/brand");
  revalidatePath("/app/marketing/brand/audiences");
  revalidatePath("/app/marketing/brand/offers");
  revalidatePath("/app/marketing/brand/voice");
  revalidatePath("/app/marketing/brand/onboarding");
}

function toFailure(error: unknown, fallback: string): BrandActionResult {
  if (error instanceof WorkspacePermissionDeniedError)
    return {
      ok: false,
      error: "You do not have permission to change the brand profile.",
    };
  return { ok: false, error: fallback };
}

export async function saveOnboardingAnswersAction(
  formData: FormData,
): Promise<BrandActionResult> {
  // The wizard posts one field per question key, so the catalogue drives what is
  // read rather than whatever the browser chose to send.
  const parsed = saveOnboardingAnswersSchema.safeParse({
    answers: ONBOARDING_QUESTIONS.filter(
      (question) => formData.get(question.key) !== null,
    ).map((question) => ({
      questionKey: question.key,
      answerText: String(formData.get(question.key) ?? ""),
    })),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Those answers are not valid.",
    };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    // A partial save never claims completion — the wizard posts the whole form
    // and `completeOnboardingAction` is the only path that can mark it done.
    await saveOnboardingAnswers({
      workspaceId: context.workspaceId,
      userId: context.userId,
      answers: parsed.data.answers,
      isComplete: false,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "Those answers could not be saved.");
  }
}

export async function completeOnboardingAction(
  formData: FormData,
): Promise<BrandActionResult> {
  const parsed = saveOnboardingAnswersSchema.safeParse({
    answers: ONBOARDING_QUESTIONS.filter(
      (question) => formData.get(question.key) !== null,
    ).map((question) => ({
      questionKey: question.key,
      answerText: String(formData.get(question.key) ?? ""),
    })),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Those answers are not valid.",
    };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    const answers = Object.fromEntries(
      parsed.data.answers.map((answer) => [
        answer.questionKey,
        answer.answerText,
      ]),
    );
    const completeness = calculateBrandCompleteness(answers);
    if (!completeness.ready)
      return {
        ok: false,
        error: `${completeness.requiredRemaining} required question${
          completeness.requiredRemaining === 1 ? "" : "s"
        } still need an answer.`,
      };

    await saveOnboardingAnswers({
      workspaceId: context.workspaceId,
      userId: context.userId,
      answers: parsed.data.answers,
      isComplete: true,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "The interview could not be completed.");
  }
}

export async function saveBrandProfileAction(
  formData: FormData,
): Promise<BrandActionResult> {
  const parsed = brandProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That profile is not valid.",
    };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    await updateBrandProfile({
      workspaceId: context.workspaceId,
      userId: context.userId,
      profile: parsed.data,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That profile could not be saved.");
  }
}

export async function saveBrandVoiceAction(
  formData: FormData,
): Promise<BrandActionResult> {
  const parsed = brandVoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Those voice rules are not valid.",
    };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    await updateBrandVoice({
      workspaceId: context.workspaceId,
      userId: context.userId,
      voice: parsed.data,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "Those voice rules could not be saved.");
  }
}

export async function saveBrandAudienceAction(
  formData: FormData,
): Promise<BrandActionResult> {
  const parsed = brandAudienceSchema.safeParse(readBrandAudienceForm(formData));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That audience is not valid.",
    };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    await upsertBrandAudience({
      workspaceId: context.workspaceId,
      brandProfileId: context.profileId,
      userId: context.userId,
      audience: parsed.data,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That audience could not be saved.");
  }
}

export async function deleteBrandAudienceAction(
  formData: FormData,
): Promise<BrandActionResult> {
  const parsed = deleteBrandEntitySchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { ok: false, error: "That audience could not be removed." };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    await deleteBrandAudience({
      workspaceId: context.workspaceId,
      audienceId: parsed.data.id,
      userId: context.userId,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That audience could not be removed.");
  }
}

export async function saveBrandOfferAction(
  formData: FormData,
): Promise<BrandActionResult> {
  const parsed = brandOfferSchema.safeParse(readBrandOfferForm(formData));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That offer is not valid.",
    };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    await upsertBrandOffer({
      workspaceId: context.workspaceId,
      brandProfileId: context.profileId,
      userId: context.userId,
      offer: parsed.data,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That offer could not be saved.");
  }
}

export async function deleteBrandOfferAction(
  formData: FormData,
): Promise<BrandActionResult> {
  const parsed = deleteBrandEntitySchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { ok: false, error: "That offer could not be removed." };

  try {
    const context = await resolveBrandContext();
    if (!context.ok) return context;

    await deleteBrandOffer({
      workspaceId: context.workspaceId,
      offerId: parsed.data.id,
      userId: context.userId,
    });

    revalidateBrand();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That offer could not be removed.");
  }
}
