import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import {
  THUMBNAIL_PROMPT_TEMPLATE_KEY,
  THUMBNAIL_PROMPT_TEMPLATE_SOURCE,
  THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH,
  THUMBNAIL_PROMPT_VERSION,
} from "@studio/prompts";
import { getDatabase } from "@/db/drizzle";
import {
  promptTemplateVersions,
  thumbnailGenerations,
  usageReservations,
  type ContentPlatform,
} from "@/db/schema";

/**
 * Ensure the versioned thumbnail prompt-template row exists. Runs
 * `INSERT ... ON CONFLICT DO NOTHING` so the feature works whether the schema
 * was applied via `db:migrate` (seed included) or `drizzle-kit push` (schema
 * only), mirroring `ensureCharacterReferencePromptTemplate`.
 */
export async function ensureThumbnailPromptTemplate(): Promise<{
  id: string;
  sourceHash: string;
}> {
  const database = getDatabase();
  await database
    .insert(promptTemplateVersions)
    .values({
      templateKey: THUMBNAIL_PROMPT_TEMPLATE_KEY,
      version: THUMBNAIL_PROMPT_VERSION,
      sourceHash: THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH,
      templateSource: THUMBNAIL_PROMPT_TEMPLATE_SOURCE,
    })
    .onConflictDoNothing();

  const [template] = await database
    .select({
      id: promptTemplateVersions.id,
      sourceHash: promptTemplateVersions.sourceHash,
    })
    .from(promptTemplateVersions)
    .where(
      and(
        eq(promptTemplateVersions.templateKey, THUMBNAIL_PROMPT_TEMPLATE_KEY),
        eq(promptTemplateVersions.version, THUMBNAIL_PROMPT_VERSION),
      ),
    )
    .limit(1);

  if (!template) throw new Error("THUMBNAIL_PROMPT_TEMPLATE_MISSING");
  return template;
}

export async function findThumbnailGeneration(input: {
  workspaceId: string;
  projectId: string;
  thumbnailGenerationId: string;
}) {
  const [generation] = await getDatabase()
    .select()
    .from(thumbnailGenerations)
    .where(
      and(
        eq(thumbnailGenerations.id, input.thumbnailGenerationId),
        eq(thumbnailGenerations.workspaceId, input.workspaceId),
        eq(thumbnailGenerations.projectId, input.projectId),
      ),
    )
    .limit(1);
  return generation ?? null;
}

export async function findThumbnailGenerationById(id: string) {
  const [generation] = await getDatabase()
    .select()
    .from(thumbnailGenerations)
    .where(eq(thumbnailGenerations.id, id))
    .limit(1);
  return generation ?? null;
}

export async function findThumbnailGenerationByIdempotencyKey(
  idempotencyKey: string,
) {
  const [generation] = await getDatabase()
    .select()
    .from(thumbnailGenerations)
    .where(eq(thumbnailGenerations.idempotencyKey, idempotencyKey))
    .limit(1);
  return generation ?? null;
}

export async function findThumbnailGenerationReservation(
  thumbnailGenerationId: string,
) {
  const [reservation] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(eq(usageReservations.thumbnailGenerationId, thumbnailGenerationId))
    .limit(1);
  return reservation ?? null;
}

/**
 * Every thumbnail generated for a platform, newest first. Unlike titles (where
 * only the latest run is shown), thumbnails accumulate into a gallery so a user
 * can compare variants and pick one to A/B test.
 */
export async function listProjectThumbnails(input: {
  workspaceId: string;
  projectId: string;
  platform: ContentPlatform;
  limit: number;
}) {
  return getDatabase()
    .select()
    .from(thumbnailGenerations)
    .where(
      and(
        eq(thumbnailGenerations.workspaceId, input.workspaceId),
        eq(thumbnailGenerations.projectId, input.projectId),
        eq(thumbnailGenerations.platform, input.platform),
        isNull(thumbnailGenerations.dismissedAt),
      ),
    )
    .orderBy(desc(thumbnailGenerations.createdAt))
    .limit(input.limit);
}
