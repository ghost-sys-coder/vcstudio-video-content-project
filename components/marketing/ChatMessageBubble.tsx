import type { UIMessage } from "ai";
import { ChatMessagePartView } from "@/components/marketing/ChatMessagePartView";
import { cn } from "@/lib/utils";

/**
 * One turn in the conversation.
 *
 * The user's turn is a bubble; the assistant's is not. An assistant reply here
 * is usually a piece of copy the user is going to read closely and then paste
 * somewhere, and full-width text at ordinary line length reads better than the
 * same text squeezed into a chat bubble.
 */
export function ChatMessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <li
      className={cn(
        "flex flex-col gap-2 text-sm",
        isUser ? "items-end" : "items-start",
      )}
    >
      <span className="sr-only">{isUser ? "You said" : "The studio said"}</span>
      <div
        className={cn(
          "max-w-[46rem] space-y-2",
          isUser
            ? "rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground"
            : "w-full",
        )}
      >
        {message.parts.map((part, index) => (
          <ChatMessagePartView key={`${message.id}-${index}`} part={part} />
        ))}
      </div>
    </li>
  );
}
