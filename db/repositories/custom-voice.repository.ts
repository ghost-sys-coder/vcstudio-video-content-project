import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { customVoices } from "@/db/schema";

export async function listCustomVoices(input: { workspaceId: string }) {
  return getDatabase()
    .select()
    .from(customVoices)
    .where(eq(customVoices.workspaceId, input.workspaceId))
    .orderBy(desc(customVoices.createdAt))
    .limit(50);
}

export async function findActiveCustomVoice(input: {
  workspaceId: string;
  customVoiceId: string;
}) {
  const [voice] = await getDatabase()
    .select()
    .from(customVoices)
    .where(
      and(
        eq(customVoices.workspaceId, input.workspaceId),
        eq(customVoices.id, input.customVoiceId),
        eq(customVoices.status, "active"),
      ),
    )
    .limit(1);
  return voice ?? null;
}
