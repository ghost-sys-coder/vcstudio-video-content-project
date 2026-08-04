import { ChatThreadSidebar } from "@/components/marketing/ChatThreadSidebar";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadChatThreadRows } from "@/lib/marketing/chat/chat-view";

/**
 * Two panes: the thread list and the conversation.
 *
 * The list lives in the layout rather than in each page so switching threads
 * does not re-render it, and so the sidebar keeps its scroll position while the
 * conversation beside it changes.
 *
 * Access is already settled by the segment layout above this one; repeating the
 * check here would be a second answer to a question that has one.
 */
export default async function MarketingChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const threads = await loadChatThreadRows({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0">
      <ChatThreadSidebar threads={threads} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
