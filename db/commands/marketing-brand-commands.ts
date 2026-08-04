import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandAudiences,
  marketingBrandOffers,
  marketingBrandProfiles,
  marketingOnboardingAnswers,
  type MarketingBrandAudience,
  type MarketingBrandOffer,
  type MarketingBrandProfile,
} from "@/db/schema";
import type {
  BrandAudienceInput,
  BrandOfferInput,
  BrandProfileInput,
  BrandVoiceInput,
} from "@/lib/schemas/marketing-brand";

/**
 * Returns the workspace's brand profile, creating an empty one if absent.
 *
 * Every other brand entity has a non-null FK to the profile, so the profile has
 * to exist before an audience or an offer can. Creating it lazily here keeps
 * that ordering out of every caller.
 */
export async function ensureBrandProfile(input: {
  workspaceId: string;
  userId: string;
}): Promise<MarketingBrandProfile> {
  const [created] = await getDatabase()
    .insert(marketingBrandProfiles)
    .values({
      workspaceId: input.workspaceId,
      updatedByUserId: input.userId,
    })
    .onConflictDoUpdate({
      target: marketingBrandProfiles.workspaceId,
      // A no-op update rather than DO NOTHING, because DO NOTHING returns no
      // row and the caller needs the existing one.
      set: { updatedAt: new Date() },
    })
    .returning();

  if (!created) throw new Error("MARKETING_BRAND_PROFILE_NOT_CREATED");
  return created;
}

/** Any change that alters the compiled brand context bumps its version. */
function bumpContext(userId: string) {
  return {
    contextVersion: sql`${marketingBrandProfiles.contextVersion} + 1`,
    updatedByUserId: userId,
    updatedAt: new Date(),
  };
}

export async function updateBrandProfile(input: {
  workspaceId: string;
  userId: string;
  profile: BrandProfileInput;
}): Promise<void> {
  await getDatabase()
    .update(marketingBrandProfiles)
    .set({
      businessName: input.profile.businessName,
      websiteUrl:
        input.profile.websiteUrl === "" ? null : input.profile.websiteUrl,
      oneLiner: input.profile.oneLiner,
      longDescription: input.profile.longDescription,
      industry: input.profile.industry,
      primaryLanguage: input.profile.primaryLanguage,
      timezone: input.profile.timezone,
      ...bumpContext(input.userId),
    })
    .where(eq(marketingBrandProfiles.workspaceId, input.workspaceId));
}

export async function updateBrandVoice(input: {
  workspaceId: string;
  userId: string;
  voice: BrandVoiceInput;
}): Promise<void> {
  await getDatabase()
    .update(marketingBrandProfiles)
    .set({ ...input.voice, ...bumpContext(input.userId) })
    .where(eq(marketingBrandProfiles.workspaceId, input.workspaceId));
}

export async function markOnboardingComplete(input: {
  workspaceId: string;
  userId: string;
}): Promise<void> {
  await getDatabase()
    .update(marketingBrandProfiles)
    .set({
      onboardingStatus: "complete",
      onboardingCompletedAt: new Date(),
      ...bumpContext(input.userId),
    })
    .where(eq(marketingBrandProfiles.workspaceId, input.workspaceId));
}

export async function saveOnboardingAnswers(input: {
  workspaceId: string;
  userId: string;
  answers: { questionKey: string; answerText: string }[];
  isComplete: boolean;
}): Promise<void> {
  const database = getDatabase();

  // Neon's HTTP driver has no interactive transactions, so this is an atomic
  // batch — the same approach the rest of the repository uses for multi-write
  // operations.
  await database.batch([
    database
      .insert(marketingOnboardingAnswers)
      .values(
        input.answers.map((answer) => ({
          workspaceId: input.workspaceId,
          questionKey: answer.questionKey,
          answerText: answer.answerText,
          answeredByUserId: input.userId,
        })),
      )
      .onConflictDoUpdate({
        target: [
          marketingOnboardingAnswers.workspaceId,
          marketingOnboardingAnswers.questionKey,
        ],
        set: {
          answerText: sql`excluded.answer_text`,
          answeredByUserId: input.userId,
          updatedAt: new Date(),
        },
      }),
    database
      .update(marketingBrandProfiles)
      .set({
        onboardingStatus: input.isComplete ? "complete" : "in_progress",
        ...(input.isComplete ? { onboardingCompletedAt: new Date() } : {}),
        ...bumpContext(input.userId),
      })
      .where(eq(marketingBrandProfiles.workspaceId, input.workspaceId)),
  ]);
}

/**
 * Creates or updates an audience.
 *
 * Promoting one to primary demotes the others first. The partial unique index
 * would otherwise reject the write — which is the correct database behaviour,
 * but a user clicking "primary" means "this one instead", not "fail".
 */
export async function upsertBrandAudience(input: {
  workspaceId: string;
  brandProfileId: string;
  userId: string;
  audience: BrandAudienceInput;
}): Promise<MarketingBrandAudience> {
  const database = getDatabase();

  if (input.audience.isPrimary)
    await database
      .update(marketingBrandAudiences)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(marketingBrandAudiences.workspaceId, input.workspaceId),
          eq(marketingBrandAudiences.brandProfileId, input.brandProfileId),
          input.audience.audienceId
            ? ne(marketingBrandAudiences.id, input.audience.audienceId)
            : sql`true`,
        ),
      );

  const values = {
    workspaceId: input.workspaceId,
    brandProfileId: input.brandProfileId,
    name: input.audience.name,
    description: input.audience.description,
    painPoints: input.audience.painPoints,
    geography: input.audience.geography,
    buyingTriggers: input.audience.buyingTriggers,
    isPrimary: input.audience.isPrimary,
    updatedAt: new Date(),
  };

  const [saved] = input.audience.audienceId
    ? await database
        .update(marketingBrandAudiences)
        .set(values)
        .where(
          and(
            eq(marketingBrandAudiences.id, input.audience.audienceId),
            eq(marketingBrandAudiences.workspaceId, input.workspaceId),
          ),
        )
        .returning()
    : await database.insert(marketingBrandAudiences).values(values).returning();

  if (!saved) throw new Error("MARKETING_BRAND_AUDIENCE_NOT_SAVED");
  await bumpProfileContext(input.workspaceId, input.userId);
  return saved;
}

export async function deleteBrandAudience(input: {
  workspaceId: string;
  audienceId: string;
  userId: string;
}): Promise<void> {
  await getDatabase()
    .delete(marketingBrandAudiences)
    .where(
      and(
        eq(marketingBrandAudiences.id, input.audienceId),
        eq(marketingBrandAudiences.workspaceId, input.workspaceId),
      ),
    );
  await bumpProfileContext(input.workspaceId, input.userId);
}

export async function upsertBrandOffer(input: {
  workspaceId: string;
  brandProfileId: string;
  userId: string;
  offer: BrandOfferInput;
}): Promise<MarketingBrandOffer> {
  const database = getDatabase();
  const values = {
    workspaceId: input.workspaceId,
    brandProfileId: input.brandProfileId,
    name: input.offer.name,
    summary: input.offer.summary,
    priceModel: input.offer.priceModel,
    audienceId: input.offer.audienceId,
    differentiators: input.offer.differentiators,
    updatedAt: new Date(),
  };

  const [saved] = input.offer.offerId
    ? await database
        .update(marketingBrandOffers)
        .set(values)
        .where(
          and(
            eq(marketingBrandOffers.id, input.offer.offerId),
            eq(marketingBrandOffers.workspaceId, input.workspaceId),
          ),
        )
        .returning()
    : await database.insert(marketingBrandOffers).values(values).returning();

  if (!saved) throw new Error("MARKETING_BRAND_OFFER_NOT_SAVED");
  await bumpProfileContext(input.workspaceId, input.userId);
  return saved;
}

export async function deleteBrandOffer(input: {
  workspaceId: string;
  offerId: string;
  userId: string;
}): Promise<void> {
  await getDatabase()
    .delete(marketingBrandOffers)
    .where(
      and(
        eq(marketingBrandOffers.id, input.offerId),
        eq(marketingBrandOffers.workspaceId, input.workspaceId),
      ),
    );
  await bumpProfileContext(input.workspaceId, input.userId);
}

async function bumpProfileContext(
  workspaceId: string,
  userId: string,
): Promise<void> {
  await getDatabase()
    .update(marketingBrandProfiles)
    .set(bumpContext(userId))
    .where(eq(marketingBrandProfiles.workspaceId, workspaceId));
}
