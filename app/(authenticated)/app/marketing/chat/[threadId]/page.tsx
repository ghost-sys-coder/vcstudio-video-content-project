import { notFound } from "next/navigation";
import { z } from "zod";
import { ChatThreadView } from "@/components/marketing/ChatThreadView";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadChatThreadView } from "@/lib/marketing/chat/chat-view";

const paramsSchema = z.object({ threadId: z.uuid() });

export default async function MarketingChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const { workspaceId } = context.activeMembership;
  // Scoped by workspace as well as id, so a thread id from another workspace is
  // a 404 rather than a leak — the same rule every entity lookup follows.
  const view = await loadChatThreadView({
    workspaceId,
    threadId: parsed.data.threadId,
  });
  if (!view) notFound();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-4 py-3">
        <h1 className="truncate text-sm font-medium">{view.title}</h1>
      </header>
      <ChatThreadView
        hasBrandProfile={view.hasBrandProfile}
        initialMessages={view.messages}
        messageCount={view.messageCount}
        threadId={view.threadId}
        totalCostCents={view.totalCostCents}
        workspaceId={workspaceId}
      />
    </div>
  );
}
