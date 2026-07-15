import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { storageObjects } from "@/db/schema";

export async function findWorkspaceLogo(workspaceId: string) {
  const [logo] = await getDatabase()
    .select()
    .from(storageObjects)
    .where(
      and(
        eq(storageObjects.workspaceId, workspaceId),
        eq(storageObjects.kind, "workspace_logo"),
      ),
    )
    .limit(1);
  return logo ?? null;
}

export async function saveWorkspaceLogo(input: {
  workspaceId: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  etag: string | null;
  createdByUserId: string;
}) {
  await getDatabase()
    .insert(storageObjects)
    .values({ ...input, kind: "workspace_logo" })
    .onConflictDoUpdate({
      target: [storageObjects.workspaceId, storageObjects.kind],
      set: {
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        etag: input.etag,
        createdByUserId: input.createdByUserId,
        updatedAt: new Date(),
      },
    });
}

export async function deleteWorkspaceLogoRecord(workspaceId: string) {
  await getDatabase()
    .delete(storageObjects)
    .where(
      and(
        eq(storageObjects.workspaceId, workspaceId),
        eq(storageObjects.kind, "workspace_logo"),
      ),
    );
}
