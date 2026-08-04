import { BookOpen, CircleAlert, Loader2 } from "lucide-react";
import type { ToolUIPart } from "ai";

/**
 * Renders one tool invocation inside an assistant turn.
 *
 * The failure state is a real state, not a hidden one. AGENTS.md is explicit
 * that a failed item must never sit inside a generic success, and a search that
 * silently returned nothing is exactly how a user comes to believe the studio
 * checked something it did not.
 *
 * Styled with semantic tokens rather than `dark:` palette utilities, because
 * the `.dim` theme never receives `dark:` variants and the card would lose its
 * tone there entirely.
 */
export function ChatToolCallCard({ part }: { part: ToolUIPart }) {
  const label = part.type.replace(/^tool-/, "").replaceAll("_", " ");
  const query =
    typeof part.input === "object" &&
    part.input !== null &&
    "query" in part.input &&
    typeof part.input.query === "string"
      ? part.input.query
      : null;

  if (part.state === "output-error")
    return (
      <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">{label}</span> failed
          {part.errorText ? `: ${part.errorText}` : "."}
        </span>
      </p>
    );

  const running =
    part.state === "input-streaming" || part.state === "input-available";

  return (
    <p className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      {running ? (
        <Loader2
          className="size-3.5 shrink-0 animate-spin"
          aria-hidden="true"
        />
      ) : (
        <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>
        {running ? "Searching" : "Searched"} {label}
        {query ? ` for “${query}”` : ""}
      </span>
    </p>
  );
}
