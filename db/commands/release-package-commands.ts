import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  releasePackageRevisions,
  releasePackages,
  videoPublications,
  type ContentPlatform,
  type PublicationVisibility,
  type ReleasePackage,
  type ReleasePackageRevision,
} from "@/db/schema";

/**
 * Raised when a save is built on a revision that is no longer current.
 *
 * Two tabs editing one release is an ordinary situation, and the loser must be
 * told rather than having their work silently overwrite or be overwritten.
 */
export class ReleasePackageConflictError extends Error {
  readonly code = "RELEASE_PACKAGE_CONFLICT";

  constructor() {
    super(
      "This release was changed somewhere else. Reload to see the current version before saving again.",
    );
    this.name = "ReleasePackageConflictError";
  }
}

export interface ReleasePackageIdentity {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
  shortCompositionId: string | null;
  platform: ContentPlatform;
  channelProfileId: string | null;
}

export interface ReleasePackageContent {
  title: string;
  titleSuggestionId: string | null;
  description: string;
  tags: string[];
  visibility: PublicationVisibility;
  thumbnailGenerationId: string | null;
  caption: string | null;
  shareToFeed: boolean | null;
  plannedReleaseAt: Date | null;
  madeForKids: boolean | null;
  containsSyntheticMedia: boolean | null;
  youtubePlaylistId: string | null;
}

/**
 * Creates or updates one destination's release draft.
 *
 * `expectedRevision` is the optimistic lock. Null means "this package does not
 * exist yet"; a number means "I was editing exactly that revision". A save that
 * matches neither is refused rather than applied, because the alternative is
 * one tab silently discarding another's work.
 *
 * Saving deliberately does NOT clear the review: whether an edit invalidates
 * the creator's confirmation is decided by comparing renders at read time, so
 * changing a description does not force a pointless re-review.
 */
export async function saveReleasePackageDraft(input: {
  identity: ReleasePackageIdentity;
  content: ReleasePackageContent;
  expectedRevision: number | null;
  actorUserId: string;
}): Promise<ReleasePackage> {
  const database = getDatabase();
  const { identity, content } = input;

  if (input.expectedRevision === null) {
    const [created] = await database
      .insert(releasePackages)
      .values({
        ...identity,
        ...content,
        revision: 1,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      })
      .onConflictDoNothing()
      .returning();
    // A conflict means someone else created this destination's package first,
    // so this save was written against a package that already moved on.
    if (!created) throw new ReleasePackageConflictError();
    return created;
  }

  const [updated] = await database
    .update(releasePackages)
    .set({
      ...content,
      revision: sql`${releasePackages.revision} + 1`,
      updatedByUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(releasePackages.workspaceId, identity.workspaceId),
        eq(releasePackages.projectId, identity.projectId),
        eq(releasePackages.outputVariantId, identity.outputVariantId),
        identity.shortCompositionId === null
          ? sql`${releasePackages.shortCompositionId} is null`
          : eq(releasePackages.shortCompositionId, identity.shortCompositionId),
        eq(releasePackages.platform, identity.platform),
        identity.channelProfileId === null
          ? sql`${releasePackages.channelProfileId} is null`
          : eq(releasePackages.channelProfileId, identity.channelProfileId),
        eq(releasePackages.revision, input.expectedRevision),
      ),
    )
    .returning();

  if (!updated) throw new ReleasePackageConflictError();
  return updated;
}

/**
 * Records that a creator looked at this package against one exact render.
 *
 * This is the explicit reconfirmation a stale package needs. It is a separate
 * action from saving so that it cannot happen as a side effect of typing.
 */
export async function confirmReleasePackageAgainstRender(input: {
  workspaceId: string;
  projectId: string;
  releasePackageId: string;
  renderId: string;
  expectedRevision: number;
  actorUserId: string;
}): Promise<ReleasePackage> {
  const [confirmed] = await getDatabase()
    .update(releasePackages)
    .set({
      reviewedRenderId: input.renderId,
      reviewedAt: new Date(),
      revision: sql`${releasePackages.revision} + 1`,
      updatedByUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(releasePackages.id, input.releasePackageId),
        eq(releasePackages.workspaceId, input.workspaceId),
        eq(releasePackages.projectId, input.projectId),
        eq(releasePackages.revision, input.expectedRevision),
      ),
    )
    .returning();

  if (!confirmed) throw new ReleasePackageConflictError();
  return confirmed;
}

/**
 * Takes an immutable copy of a package at the moment it is dispatched.
 *
 * Everything a publication needs is copied rather than referenced, so later
 * edits to the draft cannot reach an upload already in flight. The revision
 * number is allocated inside the statement from what is already frozen, so two
 * simultaneous dispatches cannot both claim the same number: the unique index
 * on (package, revision number) rejects the loser.
 */
export async function freezeReleasePackageRevision(input: {
  workspaceId: string;
  releasePackageId: string;
  renderId: string;
  actorUserId: string;
}): Promise<ReleasePackageRevision> {
  const database = getDatabase();
  const [frozen] = await database
    .insert(releasePackageRevisions)
    .select(
      database
        .select({
          workspaceId: releasePackages.workspaceId,
          releasePackageId: releasePackages.id,
          // The package id is passed as a parameter rather than as a column
          // reference: an unqualified reference to the outer row's "id" binds
          // to the subquery's own table instead, so max() saw no rows and every
          // freeze claimed revision 1.
          revisionNumber: sql<number>`(
            select coalesce(max(existing.revision_number), 0) + 1
            from release_package_revisions existing
            where existing.release_package_id = ${input.releasePackageId}::uuid
          )`.as("revision_number"),
          renderId: sql<string>`${input.renderId}::uuid`.as("render_id"),
          title: releasePackages.title,
          description: releasePackages.description,
          tags: releasePackages.tags,
          visibility: releasePackages.visibility,
          thumbnailGenerationId: releasePackages.thumbnailGenerationId,
          caption: releasePackages.caption,
          shareToFeed: releasePackages.shareToFeed,
          plannedReleaseAt: releasePackages.plannedReleaseAt,
          frozenByUserId: sql<string>`${input.actorUserId}::uuid`.as(
            "frozen_by_user_id",
          ),
        })
        .from(releasePackages)
        .where(
          and(
            eq(releasePackages.id, input.releasePackageId),
            eq(releasePackages.workspaceId, input.workspaceId),
          ),
        ),
    )
    .returning();

  if (!frozen)
    throw new Error("The release package to freeze could not be found.");
  return frozen;
}

/** Links a dispatched publication to the exact package revision it used. */
export async function attachReleaseRevisionToPublication(input: {
  workspaceId: string;
  publicationId: string;
  releasePackageRevisionId: string;
}): Promise<void> {
  await getDatabase()
    .update(videoPublications)
    .set({ releasePackageRevisionId: input.releasePackageRevisionId })
    .where(
      and(
        eq(videoPublications.id, input.publicationId),
        eq(videoPublications.workspaceId, input.workspaceId),
      ),
    );
}
