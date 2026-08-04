import { MessagesSquare, Plus } from "lucide-react";
import { startChatThreadAction } from "@/app/(authenticated)/app/marketing/chat/actions";
import { Button } from "@/components/ui/button";

/**
 * The chat index with no thread selected.
 *
 * Deliberately does not redirect into the most recent conversation. Landing
 * inside a thread the user did not choose makes the next message ambiguous —
 * they meant to start something new and continued something old instead.
 */
export default function MarketingChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <MessagesSquare
        aria-hidden="true"
        className="size-8 text-muted-foreground"
      />
      <div className="space-y-1">
        <h1 className="text-base font-medium">Marketing chat</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Ask for copy, a plan, or a fact about the business. The studio answers
          from the brand profile and the documents you have uploaded — and says
          so when it does not know.
        </p>
      </div>
      <form action={startChatThreadAction}>
        <Button size="sm" type="submit">
          <Plus aria-hidden="true" />
          New conversation
        </Button>
      </form>
    </div>
  );
}
