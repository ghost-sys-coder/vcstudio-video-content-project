"use client";

import { safeValidateUIMessages, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";

type ThreadEvents = {
  messages: Array<UIMessage & { position: number }>;
  hasRunningWork: boolean;
};

export function useMarketingThreadEvents(input: {
  workspaceId: string;
  threadId: string;
  initialLastPosition: number;
  initialHasRunningWork: boolean;
  onMessages: (messages: UIMessage[]) => void;
}) {
  const positionRef = useRef(input.initialLastPosition);
  const onMessagesRef = useRef(input.onMessages);
  const [running, setRunning] = useState(input.initialHasRunningWork);

  useEffect(() => {
    onMessagesRef.current = input.onMessages;
  }, [input.onMessages]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const poll = async () => {
      const response = await fetch(
        `/api/workspaces/${input.workspaceId}/marketing/chat/threads/${input.threadId}/events?sincePosition=${positionRef.current}`,
        { cache: "no-store" },
      );
      if (!response.ok || cancelled) return;
      const events = (await response.json()) as ThreadEvents;
      const validated = await safeValidateUIMessages({
        messages: events.messages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts,
        })),
      });
      if (validated.success && validated.data.length > 0) {
        positionRef.current = Math.max(
          positionRef.current,
          ...events.messages.map((message) => message.position),
        );
        onMessagesRef.current(validated.data);
      }
      setRunning(events.hasRunningWork);
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [input.threadId, input.workspaceId, running]);

  return { hasRunningWork: running, resume: () => setRunning(true) };
}
