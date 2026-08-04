import { createMediaStorySkill } from "@/lib/marketing/skills/definitions/create-media-story";
import { createNewsletterSkill } from "@/lib/marketing/skills/definitions/create-newsletter";
import { createSocialPostSkill } from "@/lib/marketing/skills/definitions/create-social-post";
import { searchBrandKnowledgeSkill } from "@/lib/marketing/skills/definitions/search-brand-knowledge";
import { trainBusinessKnowledgeSkill } from "@/lib/marketing/skills/definitions/train-business-knowledge";
import { writeBlogPostSkill } from "@/lib/marketing/skills/definitions/write-blog-post";
import { writeEmailSkill } from "@/lib/marketing/skills/definitions/write-email";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
import type { MarketingSkillKey } from "@/lib/marketing/skills/skill-key";

export const MARKETING_SKILL_REGISTRY = {
  create_social_post: createSocialPostSkill,
  write_email: writeEmailSkill,
  write_blog_post: writeBlogPostSkill,
  create_newsletter: createNewsletterSkill,
  create_media_story: createMediaStorySkill,
  train_business_knowledge: trainBusinessKnowledgeSkill,
  search_brand_knowledge: searchBrandKnowledgeSkill,
} satisfies Record<MarketingSkillKey, MarketingSkillDefinition>;
