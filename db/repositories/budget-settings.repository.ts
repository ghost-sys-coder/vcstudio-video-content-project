import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  workspaceBudgetSettings,
  type WorkspaceBudgetSettings,
} from "@/db/schema";

export async function getWorkspaceBudgetSettings(input: {
  workspaceId: string;
}): Promise<WorkspaceBudgetSettings | null> {
  const [row] = await getDatabase()
    .select()
    .from(workspaceBudgetSettings)
    .where(eq(workspaceBudgetSettings.workspaceId, input.workspaceId))
    .limit(1);
  return row ?? null;
}
