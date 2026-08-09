export const MARKETING_SKILL_KEYS = [
  "create_campaign",
  "create_video_draft",
  "create_social_post",
  "write_email",
  "write_blog_post",
  "create_newsletter",
  "create_media_story",
  "create_social_graphic",
  "train_business_knowledge",
  "search_brand_knowledge",
  "social_media_manager",
] as const;

export type MarketingSkillKey = (typeof MARKETING_SKILL_KEYS)[number];

export function isMarketingSkillKey(value: string): value is MarketingSkillKey {
  return (MARKETING_SKILL_KEYS as readonly string[]).includes(value);
}
