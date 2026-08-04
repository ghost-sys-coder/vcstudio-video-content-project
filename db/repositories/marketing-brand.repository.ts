import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandAudiences,
  marketingBrandOffers,
  marketingBrandProfiles,
  marketingOnboardingAnswers,
  type MarketingBrandAudience,
  type MarketingBrandOffer,
  type MarketingBrandProfile,
  type MarketingOnboardingAnswer,
} from "@/db/schema";

export async function findBrandProfile(input: {
  workspaceId: string;
}): Promise<MarketingBrandProfile | null> {
  const [profile] = await getDatabase()
    .select()
    .from(marketingBrandProfiles)
    .where(eq(marketingBrandProfiles.workspaceId, input.workspaceId))
    .limit(1);
  return profile ?? null;
}

export async function listOnboardingAnswers(input: {
  workspaceId: string;
}): Promise<MarketingOnboardingAnswer[]> {
  return getDatabase()
    .select()
    .from(marketingOnboardingAnswers)
    .where(eq(marketingOnboardingAnswers.workspaceId, input.workspaceId));
}

export async function listBrandAudiences(input: {
  workspaceId: string;
  brandProfileId: string;
}): Promise<MarketingBrandAudience[]> {
  return getDatabase()
    .select()
    .from(marketingBrandAudiences)
    .where(
      and(
        eq(marketingBrandAudiences.workspaceId, input.workspaceId),
        eq(marketingBrandAudiences.brandProfileId, input.brandProfileId),
      ),
    )
    .orderBy(
      asc(marketingBrandAudiences.position),
      asc(marketingBrandAudiences.createdAt),
    );
}

export async function listBrandOffers(input: {
  workspaceId: string;
  brandProfileId: string;
}): Promise<MarketingBrandOffer[]> {
  return getDatabase()
    .select()
    .from(marketingBrandOffers)
    .where(
      and(
        eq(marketingBrandOffers.workspaceId, input.workspaceId),
        eq(marketingBrandOffers.brandProfileId, input.brandProfileId),
      ),
    )
    .orderBy(
      asc(marketingBrandOffers.position),
      asc(marketingBrandOffers.createdAt),
    );
}
