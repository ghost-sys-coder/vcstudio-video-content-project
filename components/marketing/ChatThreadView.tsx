"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { ChatComposer } from "@/components/marketing/ChatComposer";
import { ChatCostFooter } from "@/components/marketing/ChatCostFooter";
import { ChatEmptyState } from "@/components/marketing/ChatEmptyState";
import { ChatErrorState } from "@/components/marketing/ChatErrorState";
import { ChatMessageList } from "@/components/marketing/ChatMessageList";

/**
 * The chat surface.
 *
 * Two things here are load-bearing rather than incidental.
 *
 * **Only the newest message is sent.** `prepareSendMessagesRequest` takes the
 * last message and drops the rest; the server reloads history from the
 * database. The client is not the source of truth for a conversation it could
 * otherwise rewrite.
 *
 * **The nonce belongs to the send, not to the request.** It is minted once when
 * the user presses Send and travels with that send, so a retry of the same
 * message carries the same nonce and the server recognises it as one turn
 * rather than two. A nonce generated inside the transport would be new on every
 * attempt and would idempotency-protect nothing.
 */
export function ChatThreadView({
  workspaceId,
  threadId,
  initialMessages,
  hasBrandProfile,
  messageCount,
  totalCostCents,
}: {
  workspaceId: string;
  threadId: string;
  initialMessages: UIMessage[];
  hasBrandProfile: boolean;
  messageCount: number;
  totalCostCents: number;
}) {
  const router = useRouter();
  const [transportError, setTransportError] = useState<string | null>(null);
  const lastSendRef = useRef<{ text: string; requestNonce: string } | null>(
    null,
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/workspaces/${workspaceId}/marketing/chat`,
        prepareSendMessagesRequest: ({ messages: sendable, body }) => {
          const newest = sendable.at(-1);
          return {
            body: {
              // `body` carries the per-send options, including the nonce.
              ...body,
              threadId,
              message: newest
                ? {
                    id: newest.id,
                    role: "user",
                    parts: newest.parts.filter((part) => part.type === "text"),
                  }
                : undefined,
            },
          };
        },
      }),
    [workspaceId, threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (cause) => setTransportError(cause.message),
    onFinish: () => {
      // Thread totals, the sidebar's ordering, and the auto-derived title are
      // all server state that this turn just changed. Refreshing the segment is
      // cheaper than mirroring the same arithmetic in the client and hoping the
      // two agree.
      router.refresh();
    },
  });

  const streaming = status === "streaming" || status === "submitted";

  const send = useCallback(
    (text: string) => {
      setTransportError(null);
      const requestNonce = crypto.randomUUID();
      lastSendRef.current = { text, requestNonce };
      void sendMessage({ text }, { body: { requestNonce } });
    },
    [sendMessage],
  );

  const retry = useCallback(() => {
    const previous = lastSendRef.current;
    if (!previous) return;
    setTransportError(null);
    // The same nonce, deliberately: a first attempt that landed but never
    // streamed back must not become a second message and a second charge.
    void sendMessage(
      { text: previous.text },
      { body: { requestNonce: previous.requestNonce } },
    );
  }, [sendMessage]);

  const failure = transportError ?? error?.message ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto">
          <ChatEmptyState hasBrandProfile={hasBrandProfile} />
        </div>
      ) : (
        <ChatMessageList messages={messages} waiting={status === "submitted"} />
      )}

      {failure ? (
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <ChatErrorState message={failure} onRetry={retry} />
        </div>
      ) : null}

      <ChatComposer
        disabled={false}
        onSend={send}
        onStop={() => void stop()}
        streaming={streaming}
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-3">
        <ChatCostFooter
          messageCount={messageCount}
          totalCostCents={totalCostCents}
        />
      </div>
    </div>
  );
}
