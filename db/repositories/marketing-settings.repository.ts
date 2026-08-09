import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingSettings, type MarketingSettings } from "@/db/schema";

export async function findMarketingSettings(input: {
  workspaceId: string;
}): Promise<MarketingSettings | null> {
  const [settings] = await getDatabase()
    .select()
    .from(marketingSettings)
    .where(eq(marketingSettings.workspaceId, input.workspaceId))
    .limit(1);
  return settings ?? null;
}

export async function listMarketingEnabledWorkspaceIds() {
  return getDatabase()
    .select({ workspaceId: marketingSettings.workspaceId })
    .from(marketingSettings)
    .where(eq(marketingSettings.studioEnabled, true));
}
