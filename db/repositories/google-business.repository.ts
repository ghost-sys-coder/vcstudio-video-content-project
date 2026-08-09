import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  googleBusinessConnections,
  googleBusinessLocations,
} from "@/db/schema";

export async function findGoogleBusinessConnection(input: {
  workspaceId: string;
}) {
  const [connection] = await getDatabase()
    .select()
    .from(googleBusinessConnections)
    .where(eq(googleBusinessConnections.workspaceId, input.workspaceId))
    .limit(1);
  return connection ?? null;
}

export async function listGoogleBusinessLocations(input: {
  workspaceId: string;
  selectedOnly?: boolean;
}) {
  return getDatabase()
    .select()
    .from(googleBusinessLocations)
    .where(
      input.selectedOnly
        ? and(
            eq(googleBusinessLocations.workspaceId, input.workspaceId),
            eq(googleBusinessLocations.selected, true),
          )
        : eq(googleBusinessLocations.workspaceId, input.workspaceId),
    )
    .orderBy(asc(googleBusinessLocations.title));
}

export async function listActiveGoogleBusinessConnections() {
  return getDatabase()
    .select({
      id: googleBusinessConnections.id,
      workspaceId: googleBusinessConnections.workspaceId,
    })
    .from(googleBusinessConnections)
    .where(eq(googleBusinessConnections.status, "active"));
}
