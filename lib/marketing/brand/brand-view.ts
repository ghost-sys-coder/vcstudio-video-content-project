import "server-only";

import {
  findBrandProfile,
  listBrandAudiences,
  listBrandOffers,
  listOnboardingAnswers,
} from "@/db/repositories/marketing-brand.repository";
import type {
  MarketingBrandAudience,
  MarketingBrandOffer,
  MarketingOnboardingStatus,
} from "@/db/schema";
import {
  calculateBrandCompleteness,
  type BrandCompleteness,
} from "@/lib/marketing/brand/brand-completeness";

export type BrandProfileView = {
  exists: boolean;
  businessName: string;
  websiteUrl: string;
  oneLiner: string;
  longDescription: string;
  industry: string;
  primaryLanguage: string;
  timezone: string;
  brandVoiceSummary: string;
  toneAttributes: string[];
  writingRules: string[];
  bannedPhrases: string[];
  valueProps: string[];
  proofPoints: string[];
  complianceNotes: string;
  onboardingStatus: MarketingOnboardingStatus;
  contextVersion: number;
};

export type BrandWorkspaceView = {
  profile: BrandProfileView;
  answers: Record<string, string>;
  completeness: BrandCompleteness;
  audiences: MarketingBrandAudience[];
  offers: MarketingBrandOffer[];
};

const EMPTY_PROFILE: BrandProfileView = {
  exists: false,
  businessName: "",
  websiteUrl: "",
  oneLiner: "",
  longDescription: "",
  industry: "",
  primaryLanguage: "English",
  timezone: "UTC",
  brandVoiceSummary: "",
  toneAttributes: [],
  writingRules: [],
  bannedPhrases: [],
  valueProps: [],
  proofPoints: [],
  complianceNotes: "",
  onboardingStatus: "not_started",
  contextVersion: 1,
};

/**
 * Everything the brand pages need, in one read.
 *
 * A workspace that has never opened the studio has no profile row at all, which
 * is a valid state rather than a missing one — the view fills in empty defaults
 * so no page has to branch on existence.
 */
export async function loadBrandWorkspaceView(input: {
  workspaceId: string;
}): Promise<BrandWorkspaceView> {
  const [profile, answerRows] = await Promise.all([
    findBrandProfile({ workspaceId: input.workspaceId }),
    listOnboardingAnswers({ workspaceId: input.workspaceId }),
  ]);

  const answers = Object.fromEntries(
    answerRows.map((row) => [row.questionKey, row.answerText]),
  );
  const completeness = calculateBrandCompleteness(answers);

  if (!profile)
    return {
      profile: EMPTY_PROFILE,
      answers,
      completeness,
      audiences: [],
      offers: [],
    };

  const [audiences, offers] = await Promise.all([
    listBrandAudiences({
      workspaceId: input.workspaceId,
      brandProfileId: profile.id,
    }),
    listBrandOffers({
      workspaceId: input.workspaceId,
      brandProfileId: profile.id,
    }),
  ]);

  return {
    profile: {
      exists: true,
      businessName: profile.businessName,
      websiteUrl: profile.websiteUrl ?? "",
      oneLiner: profile.oneLiner,
      longDescription: profile.longDescription,
      industry: profile.industry,
      primaryLanguage: profile.primaryLanguage,
      timezone: profile.timezone,
      brandVoiceSummary: profile.brandVoiceSummary,
      toneAttributes: profile.toneAttributes,
      writingRules: profile.writingRules,
      bannedPhrases: profile.bannedPhrases,
      valueProps: profile.valueProps,
      proofPoints: profile.proofPoints,
      complianceNotes: profile.complianceNotes,
      onboardingStatus: profile.onboardingStatus,
      contextVersion: profile.contextVersion,
    },
    answers,
    completeness,
    audiences,
    offers,
  };
}
