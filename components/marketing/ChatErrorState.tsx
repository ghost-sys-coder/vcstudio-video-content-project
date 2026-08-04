import { Button } from "@/components/ui/button";

/**
 * A failed turn, said plainly, with the work preserved.
 *
 * Retrying resends the message the user already typed rather than clearing the
 * composer, because losing somebody's paragraph to a transient provider error
 * is the part of a failure they will actually remember.
 */
export function ChatErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
      role="alert"
    >
      <p>{message}</p>
      <Button onClick={onRetry} size="sm" type="button" variant="outline">
        Try again
      </Button>
    </div>
  );
}
