import { ProductionQueuePageContent } from "@/components/production/ProductionQueuePageContent";
import { listChannelProfiles } from "@/db/repositories/channel-profiles.repository";
import { loadProductionQueue } from "@/db/repositories/production-queue.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { productionQueueQuerySchema } from "@/lib/schemas/production-queue";

/** A repeated query parameter must narrow the page, never break it. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductionQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const workspaceId = context.activeMembership.workspaceId;
  const params = await searchParams;
  const query = productionQueueQuerySchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
    channelProfileId: firstValue(params.channelProfileId),
    release: firstValue(params.release),
    attention: firstValue(params.attention),
    includeArchived: firstValue(params.includeArchived),
  });

  const [queue, channelRows] = await Promise.all([
    loadProductionQueue({ workspaceId, query }),
    listChannelProfiles({ workspaceId }),
  ]);

  return (
    <ProductionQueuePageContent
      attention={query.attention}
      channelProfileId={query.channelProfileId}
      channels={channelRows.map((row) => ({
        id: row.profile.id,
        name: row.profile.name,
      }))}
      queue={queue}
      release={query.release}
    />
  );
}
