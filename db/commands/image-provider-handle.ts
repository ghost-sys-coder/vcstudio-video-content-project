import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  providerRequests,
  characterReferenceGenerations,
  thumbnailGenerations,
  mcpOperations,
} from "@/db/schema";

export type ImageProviderOwner = {
  workspaceId: string;
  generationId: string;
  kind: "scene" | "character" | "thumbnail" | "mcp";
};
/** Only one worker may cross the billable thumbnail submission boundary. */
export async function claimElevenLabsThumbnail(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const rows = await getDatabase()
    .update(thumbnailGenerations)
    .set({
      status: "running",
      attemptCount: 1,
      progressPercent: 25,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(thumbnailGenerations.id, input.generationId),
        eq(thumbnailGenerations.workspaceId, input.workspaceId),
        eq(thumbnailGenerations.projectId, input.projectId),
        eq(thumbnailGenerations.attemptCount, 0),
        inArray(thumbnailGenerations.status, ["pending", "queued"]),
      ),
    )
    .returning({ id: thumbnailGenerations.id });
  return rows.length === 1;
}
/** Persist the remote handle before polling/download. A crash never authorizes a new POST. */
export async function saveImageProviderHandle(
  owner: ImageProviderOwner,
  id: string,
) {
  const db = getDatabase();
  if (owner.kind === "scene") {
    const rows = await db
      .update(providerRequests)
      .set({ providerRequestId: id, updatedAt: new Date() })
      .where(
        and(
          eq(providerRequests.workspaceId, owner.workspaceId),
          eq(providerRequests.generationId, owner.generationId),
          eq(providerRequests.status, "running"),
        ),
      )
      .returning({ id: providerRequests.id });
    if (!rows.length) throw new Error("Image operation is no longer active.");
  } else if (owner.kind === "mcp") {
    const rows = await db
      .update(mcpOperations)
      .set({
        result: sql`coalesce(${mcpOperations.result}, '{}'::jsonb) || ${JSON.stringify({ providerJobId: id, providerRequestId: id })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mcpOperations.workspaceId, owner.workspaceId),
          eq(mcpOperations.id, owner.generationId),
          eq(mcpOperations.status, "running"),
        ),
      )
      .returning({ id: mcpOperations.id });
    if (!rows.length) throw new Error("Image operation is no longer active.");
  } else {
    const table =
      owner.kind === "character"
        ? characterReferenceGenerations
        : thumbnailGenerations;
    const rows = await db
      .update(table)
      .set({ providerRequestId: id, updatedAt: new Date() })
      .where(
        and(
          eq(table.workspaceId, owner.workspaceId),
          eq(table.id, owner.generationId),
          eq(table.status, "running"),
        ),
      )
      .returning({ id: table.id });
    if (!rows.length) throw new Error("Image operation is no longer active.");
  }
}
