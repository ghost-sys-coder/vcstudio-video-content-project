import { Plus } from "lucide-react";
import {
  ChatThreadRow,
  type ChatThreadRowData,
} from "@/components/marketing/ChatThreadRow";
import { Button } from "@/components/ui/button";
import { startChatThreadAction } from "@/app/(authenticated)/app/marketing/chat/actions";

/**
 * The thread list.
 *
 * "New conversation" is a form posting to a server action rather than a link,
 * because the thread row is created before the user types: with an id in hand
 * the composer can send its first message like any other, and the streaming
 * endpoint never has to mint a thread mid-stream and tell the client about it
 * out of band.
 */
export function ChatThreadSidebar({
  threads,
}: {
  threads: ChatThreadRowData[];
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 border-r border-border p-3">
      <form action={startChatThreadAction}>
        <Button className="w-full" size="sm" type="submit" variant="outline">
          <Plus aria-hidden="true" />
          New conversation
        </Button>
      </form>

      <nav
        aria-label="Conversations"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {threads.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {threads.map((thread) => (
              <ChatThreadRow key={thread.id} thread={thread} />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
