import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { customVoices, voicePresets } from "@/db/schema";

export async function createCustomVoice(input: {
  workspaceId: string;
  name: string;
  providerVoiceId: string;
  providerConsentId: string;
  consentLanguage: string;
  createdByUserId: string;
}) {
  const [created] = await getDatabase()
    .insert(customVoices)
    .values({ ...input, provider: "openai" })
    .returning();
  if (!created) throw new Error("CUSTOM_VOICE_CREATE_FAILED");
  return created;
}

export async function revokeCustomVoice(input: {
  workspaceId: string;
  customVoiceId: string;
  revokedByUserId: string;
}) {
  const now = new Date();
  const database = getDatabase();
  const [, rows] = await database.batch([
    database
      .update(voicePresets)
      .set({ archivedAt: now, isDefault: false, updatedAt: now })
      .where(
        and(
          eq(voicePresets.workspaceId, input.workspaceId),
          eq(voicePresets.customVoiceId, input.customVoiceId),
        ),
      ),
    database
      .update(customVoices)
      .set({
        status: "revoked",
        revokedAt: now,
        revokedByUserId: input.revokedByUserId,
        updatedAt: now,
      })
      .where(
        and(
          eq(customVoices.workspaceId, input.workspaceId),
          eq(customVoices.id, input.customVoiceId),
          eq(customVoices.status, "active"),
        ),
      )
      .returning(),
  ]);
  if (!rows[0]) throw new Error("CUSTOM_VOICE_NOT_ACTIVE");
  return rows[0];
}
