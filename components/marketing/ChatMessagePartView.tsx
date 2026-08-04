import {
  isStaticToolUIPart,
  type UIDataTypes,
  type UIMessagePart,
  type UITools,
} from "ai";
import { ChatToolCallCard } from "@/components/marketing/ChatToolCallCard";
import { ChatDeferredResultCard } from "@/components/marketing/ChatDeferredResultCard";
import { marketingChatToolResultPartSchema } from "@/lib/schemas/marketing-chat-message";

/**
 * Renders one part of a message.
 *
 * Deliberately renders text as plain text rather than parsing Markdown. Model
 * output is untrusted by construction — it can quote a document that contains
 * anything — and this slice has no sanitiser. Copy that shows its own asterisks
 * is a cosmetic problem; injected markup is not. Rich rendering arrives with a
 * sanitiser, not before it.
 */
export function ChatMessagePartView({
  part,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
}) {
  if (part.type === "text")
    return <p className="whitespace-pre-wrap">{part.text}</p>;

  if (part.type === "data-toolResult") {
    const parsed = marketingChatToolResultPartSchema.shape.data.safeParse(
      part.data,
    );
    return parsed.success ? (
      <ChatDeferredResultCard result={parsed.data} />
    ) : null;
  }

  // Static rather than dynamic tool parts: every tool in this slice is declared
  // in code, so a dynamic one would mean something unexpected reached the
  // stream and is not something to render as though it were normal.
  if (isStaticToolUIPart(part)) return <ChatToolCallCard part={part} />;

  // Reasoning, files, sources, step markers: nothing this slice produces or
  // needs to show. Rendering an unknown part as raw JSON would be worse than
  // rendering nothing.
  return null;
}
