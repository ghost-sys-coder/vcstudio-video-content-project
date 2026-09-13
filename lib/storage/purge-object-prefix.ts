import "server-only";

import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

/** S3/R2 caps both listing and bulk deletion at 1000 keys per call. */
const KEYS_PER_PAGE = 1000;

export class StoragePurgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePurgeError";
  }
}

/**
 * Permanently deletes every stored object under one prefix.
 *
 * Works by prefix rather than by walking the database's recorded object keys,
 * which matters for the stated goal of not wasting storage: assets whose rows
 * never landed (a generation that uploaded and then failed to record, a render
 * that was cancelled mid-write) have no row to walk but still occupy space.
 * The prefix catches those too.
 *
 * Idempotent — purging an already-empty prefix is a no-op — so a caller may
 * safely retry after any failure.
 *
 * `maxPages` is a deliberate refusal rather than a performance knob. Reaching
 * it means the prefix is not what the caller thinks it is, and quietly deleting
 * an unbounded number of objects is not a failure mode worth having, so each
 * caller sets it from what its own prefix could plausibly hold.
 */
export async function purgeObjectPrefix(input: {
  prefix: string;
  maxPages: number;
  /** Named in the error text, so a failure says what could not be deleted. */
  subject: string;
}): Promise<{ deletedCount: number }> {
  const environment = getStorageEnvironment();
  const client = getR2Client();

  let continuationToken: string | undefined;
  let deletedCount = 0;

  for (let page = 0; page < input.maxPages; page++) {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: environment.R2_BUCKET_NAME,
        Prefix: input.prefix,
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
        throw new StoragePurgeError(
          `Failed to delete ${deleted.Errors.length} of ${keys.length} stored objects for ${input.subject}.`,
        );
      deletedCount += keys.length;
    }

    if (!listed.IsTruncated) return { deletedCount };
    continuationToken = listed.NextContinuationToken;
    if (!continuationToken) return { deletedCount };
  }

  throw new StoragePurgeError(
    `Stopped after ${input.maxPages} pages while purging ${input.subject}; ${deletedCount} objects were deleted before stopping.`,
  );
}
