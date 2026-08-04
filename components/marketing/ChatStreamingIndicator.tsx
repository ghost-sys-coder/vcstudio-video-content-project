/**
 * Shown between "sent" and the first token.
 *
 * `role="status"` rather than a bare animation: a screen reader user gets no
 * information at all from three pulsing dots, and this is the one moment in the
 * conversation where nothing else on the page has changed.
 */
export function ChatStreamingIndicator() {
  return (
    <p
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <span className="flex gap-1" aria-hidden="true">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </span>
      Thinking…
    </p>
  );
}
