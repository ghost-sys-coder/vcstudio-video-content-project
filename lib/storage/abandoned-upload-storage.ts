import "server-only";

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";
import { assertSafeReconciliationObjectKey } from "@/lib/storage/reconciliation-storage";

export type ListedWorkspaceObject = {
  objectKey: string;
  lastModified: Date;
};

export async function listWorkspaceObjectsForReconciliation(input: {
  startAfter: string | null;
  limit: number;
}): Promise<{
  objects: ListedWorkspaceObject[];
  nextStartAfter: string | null;
}> {
  if (input.startAfter) assertSafeReconciliationObjectKey(input.startAfter);
  const result = await getR2Client().send(
    new ListObjectsV2Command({
      Bucket: getStorageEnvironment().R2_BUCKET_NAME,
      Prefix: "workspaces/",
      StartAfter: input.startAfter ?? undefined,
      MaxKeys: input.limit,
    }),
  );
  const objects = (result.Contents ?? []).flatMap((object) => {
    if (!object.Key || !object.LastModified) return [];
    assertSafeReconciliationObjectKey(object.Key);
    return [{ objectKey: object.Key, lastModified: object.LastModified }];
  });
  const last = objects.at(-1)?.objectKey ?? null;
  return {
    objects,
    nextStartAfter: result.IsTruncated ? last : null,
  };
}
