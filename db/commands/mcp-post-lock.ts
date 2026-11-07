import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { socialPosts } from "@/db/schema";
import { REPUBLISHABLE_SOCIAL_POST_STATUSES } from "@/db/commands/social-post-commands";
export async function lockMcpPost(input: {
  workspaceId: string;
  postId: string;
  expectedVersion: number;
  operationId: string;
  cancellation?: boolean;
  finishing?: boolean;
}) {
  const [row] = await getDatabase()
    .update(socialPosts)
    .set({ mcpOperationId: input.operationId })
    .where(
      and(
        eq(socialPosts.workspaceId, input.workspaceId),
        eq(socialPosts.id, input.postId),
        eq(socialPosts.version, input.expectedVersion),
        isNull(socialPosts.mcpOperationId),
        inArray(
          socialPosts.status,
          input.finishing
            ? [
                "published",
                "partially_failed",
                "awaiting_completion",
                "publishing",
              ]
            : input.cancellation
              ? ["scheduled"]
              : [...REPUBLISHABLE_SOCIAL_POST_STATUSES],
        ),
      ),
    )
    .returning();
  return row ?? null;
}
export async function unlockMcpPost(
  workspaceId: string,
  postId: string,
  operationId: string,
) {
  await getDatabase()
    .update(socialPosts)
    .set({ mcpOperationId: null })
    .where(
      and(
        eq(socialPosts.workspaceId, workspaceId),
        eq(socialPosts.id, postId),
        eq(socialPosts.mcpOperationId, operationId),
      ),
    );
}
