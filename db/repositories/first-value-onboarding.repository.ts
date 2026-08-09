import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";

export type FirstValueFacts = {
  brandComplete: boolean;
  budgetConfigured: boolean;
  publishingConnected: boolean;
  googleBusinessConnected: boolean;
  projectCreated: boolean;
  marketingDraftCreated: boolean;
  assetApproved: boolean;
  renderCompleted: boolean;
  postPublished: boolean;
};

export async function loadFirstValueFacts(
  workspaceId: string,
): Promise<FirstValueFacts> {
  const result = await getDatabase().execute<FirstValueFacts>(sql`
    select
      exists(select 1 from marketing_brand_profiles where workspace_id = ${workspaceId} and onboarding_status = 'complete') as "brandComplete",
      exists(select 1 from workspace_budget_settings where workspace_id = ${workspaceId}) as "budgetConfigured",
      exists(select 1 from platform_connections where workspace_id = ${workspaceId} and status = 'active') as "publishingConnected",
      exists(select 1 from google_business_connections where workspace_id = ${workspaceId} and status = 'active') as "googleBusinessConnected",
      exists(select 1 from projects where workspace_id = ${workspaceId}) as "projectCreated",
      exists(select 1 from marketing_content_items where workspace_id = ${workspaceId}) as "marketingDraftCreated",
      (exists(select 1 from scene_image_generations where workspace_id = ${workspaceId} and review_status = 'approved') or exists(select 1 from scene_audio_generations where workspace_id = ${workspaceId} and review_status = 'approved')) as "assetApproved",
      exists(select 1 from video_renders where workspace_id = ${workspaceId} and status = 'succeeded') as "renderCompleted",
      exists(select 1 from social_posts where workspace_id = ${workspaceId} and status in ('published','partially_failed')) as "postPublished"
  `);
  const row = result.rows[0];
  if (!row) throw new Error("FIRST_VALUE_FACTS_UNAVAILABLE");
  return row;
}
