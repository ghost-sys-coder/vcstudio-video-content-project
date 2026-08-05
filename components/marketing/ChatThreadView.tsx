"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "@/components/marketing/ChatComposer";
import { ChatCostFooter } from "@/components/marketing/ChatCostFooter";
import { ChatEmptyState } from "@/components/marketing/ChatEmptyState";
import { ChatErrorState } from "@/components/marketing/ChatErrorState";
import { ChatMessageList } from "@/components/marketing/ChatMessageList";
import {
  prepareMarketingChatRequest,
  type MarketingChatSendBody,
} from "@/lib/marketing/chat/prepare-chat-request";
import type { MarketingSkillCatalogueItem } from "@/lib/marketing/skills/skill-definition";
import { useMarketingThreadEvents } from "@/hooks/useMarketingThreadEvents";

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
  catalogue,
  initialLastPosition,
  initialHasRunningWork,
}: {
  workspaceId: string;
  threadId: string;
  initialMessages: UIMessage[];
  hasBrandProfile: boolean;
  messageCount: number;
  totalCostCents: number;
  catalogue: MarketingSkillCatalogueItem[];
  initialLastPosition: number;
  initialHasRunningWork: boolean;
}) {
  const router = useRouter();
  const [transportError, setTransportError] = useState<string | null>(null);
  const lastSendRef = useRef<{
    text: string;
    body: MarketingChatSendBody;
  } | null>(null);
  const resumeEventsRef = useRef<() => void>(() => undefined);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/workspaces/${workspaceId}/marketing/chat`,
        prepareSendMessagesRequest: ({ messages: sendable, body }) => {
          return prepareMarketingChatRequest({
            messages: sendable,
            body: body as MarketingChatSendBody,
            threadId,
          });
        },
      }),
    [workspaceId, threadId],
  );

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
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
      resumeEventsRef.current();
    },
  });

  const events = useMarketingThreadEvents({
    workspaceId,
    threadId,
    initialLastPosition,
    initialHasRunningWork,
    onMessages: (incoming) =>
      setMessages((current) => {
        const ids = new Set(current.map((message) => message.id));
        return [
          ...current,
          ...incoming.filter((message) => !ids.has(message.id)),
        ];
      }),
  });
  useEffect(() => {
    resumeEventsRef.current = events.resume;
  }, [events.resume]);

  const streaming = status === "streaming" || status === "submitted";

  const send = useCallback(
    (text: string) => {
      setTransportError(null);
      const requestNonce = crypto.randomUUID();
      const body = { requestNonce };
      lastSendRef.current = { text, body };
      void sendMessage({ text }, { body });
    },
    [sendMessage],
  );

  const retry = useCallback(() => {
    const previous = lastSendRef.current;
    if (!previous) return;
    setTransportError(null);
    // The same nonce, deliberately: a first attempt that landed but never
    // streamed back must not become a second message and a second charge.
    void sendMessage({ text: previous.text }, { body: previous.body });
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
        catalogue={catalogue}
        disabled={false}
        onInvokeSkill={(skill, inputs) => {
          setTransportError(null);
          const requestNonce = crypto.randomUUID();
          const text = `/${skill.key}: ${Object.values(inputs).filter(Boolean).join(" · ")}`;
          const body: MarketingChatSendBody = {
            requestNonce,
            skillInvocation: {
              type: "data-skillInvocation",
              skillKey: skill.key,
              inputs,
            },
          };
          lastSendRef.current = { text, body };
          void sendMessage({ text }, { body });
          events.resume();
        }}
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
