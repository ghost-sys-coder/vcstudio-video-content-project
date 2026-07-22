import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectOutputVariants,
  sceneImageGenerations,
  sceneVariantFramings,
} from "@/db/schema";

export async function listProjectOutputVariants(input: {
  workspaceId: string;
  projectId: string;
}) {
  return getDatabase()
    .select()
    .from(projectOutputVariants)
    .where(
      and(
        eq(projectOutputVariants.workspaceId, input.workspaceId),
        eq(projectOutputVariants.projectId, input.projectId),
      ),
    )
    .orderBy(asc(projectOutputVariants.width), asc(projectOutputVariants.id));
}

export async function findProjectOutputVariant(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
}) {
  const [variant] = await getDatabase()
    .select()
    .from(projectOutputVariants)
    .where(
      and(
        eq(projectOutputVariants.workspaceId, input.workspaceId),
        eq(projectOutputVariants.projectId, input.projectId),
        eq(projectOutputVariants.id, input.outputVariantId),
      ),
    )
    .limit(1);
  return variant ?? null;
}

export async function listSceneVariantFramings(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
}) {
  return getDatabase()
    .select()
    .from(sceneVariantFramings)
    .where(
      and(
        eq(sceneVariantFramings.workspaceId, input.workspaceId),
        eq(sceneVariantFramings.projectId, input.projectId),
        eq(sceneVariantFramings.outputVariantId, input.outputVariantId),
      ),
    );
}

export async function listSceneVariantOutpaints(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
}) {
  return getDatabase()
    .select()
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.outputVariantId, input.outputVariantId),
        eq(sceneImageGenerations.purpose, "variant_outpaint"),
      ),
    )
    .orderBy(desc(sceneImageGenerations.createdAt));
}
