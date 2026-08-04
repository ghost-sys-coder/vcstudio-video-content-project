"use client";

import { Send, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MARKETING_CHAT_MAX_USER_CHARACTERS } from "@/lib/schemas/marketing-chat-message";

/**
 * The message box.
 *
 * `Enter` sends and `Shift+Enter` inserts a newline, which is the convention
 * every chat surface has trained people to expect. The composer clears only
 * after `onSend` has accepted the text — a send that throws leaves the user's
 * paragraph exactly where they left it.
 *
 * While a reply is streaming the send button becomes a stop button rather than
 * disappearing: the control the user reaches for mid-answer is "stop", and
 * moving it somewhere else costs them the answer they wanted to interrupt.
 */
export function ChatComposer({
  disabled,
  streaming,
  onSend,
  onStop,
}: {
  disabled: boolean;
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const tooLong = value.length > MARKETING_CHAT_MAX_USER_CHARACTERS;
  const canSend = trimmed !== "" && !tooLong && !disabled && !streaming;

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  }

  return (
    <form
      className="mx-auto w-full max-w-3xl px-4 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="rounded-2xl border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring/40">
        <label className="sr-only" htmlFor="marketing-chat-input">
          Message the marketing studio
        </label>
        <Textarea
          className="min-h-20 resize-none border-0 shadow-none focus-visible:ring-0"
          disabled={disabled}
          id="marketing-chat-input"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask for a post, an email, a plan — or a question about the business."
          ref={textareaRef}
          value={value}
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <span
            className={
              tooLong
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {tooLong
              ? `${value.length.toLocaleString()} of ${MARKETING_CHAT_MAX_USER_CHARACTERS.toLocaleString()} characters`
              : "Enter to send · Shift+Enter for a new line"}
          </span>
          {streaming ? (
            <Button onClick={onStop} size="sm" type="button" variant="outline">
              <Square aria-hidden="true" />
              Stop
            </Button>
          ) : (
            <Button disabled={!canSend} size="sm" type="submit">
              <Send aria-hidden="true" />
              Send
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
