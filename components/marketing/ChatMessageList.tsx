"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { ChatMessageBubble } from "@/components/marketing/ChatMessageBubble";
import { ChatStreamingIndicator } from "@/components/marketing/ChatStreamingIndicator";

/**
 * The transcript, scrolled to the newest turn.
 *
 * Scrolls only while the user is already near the bottom. Yanking the viewport
 * down mid-token would make it impossible to read back over an earlier answer
 * while the next one arrives, which is exactly what somebody comparing two
 * drafts is trying to do.
 */
export function ChatMessageList({
  messages,
  waiting,
}: {
  messages: UIMessage[];
  waiting: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 160)
      endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, waiting]);

  return (
    <div className="flex-1 overflow-y-auto" ref={containerRef}>
      <ul className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
        {waiting ? (
          <li>
            <ChatStreamingIndicator />
          </li>
        ) : null}
      </ul>
      <div ref={endRef} />
    </div>
  );
}
