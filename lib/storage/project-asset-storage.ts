import "server-only";

import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";
import { createProjectAssetPrefix } from "@/lib/storage/object-key";

/** S3/R2 caps both listing and bulk deletion at 1000 keys per call. */
const KEYS_PER_PAGE = 1000;

/**
 * Refuses to keep paginating past this many objects. A real project is in the
 * hundreds; anything beyond this means the prefix is not what we think it is,
 * and quietly deleting a hundred thousand objects is not a failure mode worth
 * having.
 */
const MAX_PAGES = 50;

export class ProjectAssetPurgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectAssetPurgeError";
  }
}

/**
 * Permanently deletes every stored object belonging to a project.
 *
 * Works by prefix rather than by walking the database's recorded object keys,
 * which matters for the stated goal of not wasting storage: assets whose rows
 * never landed (a generation that uploaded and then failed to record, a render
 * that was cancelled mid-write) have no row to walk but still occupy space.
 * The prefix catches those too.
 *
 * Idempotent — deleting an already-purged prefix is a no-op — so a caller may
 * safely retry after any failure.
 */
export async function deleteProjectAssetObjects(input: {
  workspaceId: string;
  projectId: string;
}): Promise<{ deletedCount: number }> {
  const environment = getStorageEnvironment();
  const client = getR2Client();
  const prefix = createProjectAssetPrefix(input);

  let continuationToken: string | undefined;
  let deletedCount = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: environment.R2_BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: KEYS_PER_PAGE,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listed.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => typeof key === "string");

    if (keys.length > 0) {
      const deleted = await client.send(
        new DeleteObjectsCommand({
          Bucket: environment.R2_BUCKET_NAME,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      // A partial failure must not be mistaken for success, or the caller will
      // go on to delete the database rows that point at the surviving objects
      // and the leak becomes untraceable.
      if (deleted.Errors?.length)
        throw new ProjectAssetPurgeError(
          `Failed to delete ${deleted.Errors.length} of ${keys.length} stored objects for this project.`,
        );
      deletedCount += keys.length;
    }

    if (!listed.IsTruncated) return { deletedCount };
    continuationToken = listed.NextContinuationToken;
    if (!continuationToken) return { deletedCount };
  }

  throw new ProjectAssetPurgeError(
    `Stopped after ${MAX_PAGES} pages while purging project assets; ${deletedCount} objects were deleted before stopping.`,
  );
}
