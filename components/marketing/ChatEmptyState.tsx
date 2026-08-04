import { MessagesSquare } from "lucide-react";

/**
 * What an empty thread says.
 *
 * The suggestions are specific rather than decorative. A blank chat box invites
 * "hello", and the first answer a user gets shapes what they believe the studio
 * is for — so the examples are the three things it can actually do well from a
 * brand profile alone.
 */
export function ChatEmptyState({
  hasBrandProfile,
}: {
  hasBrandProfile: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <MessagesSquare
        className="size-8 text-muted-foreground"
        aria-hidden="true"
      />
      <h2 className="text-base font-medium">Ask the studio</h2>
      {hasBrandProfile ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>“Write a LinkedIn post about what we do, for founders.”</li>
          <li>“What does our pricing page actually say?”</li>
          <li>“Draft three subject lines for a re-engagement email.”</li>
        </ul>
      ) : (
        <p className="max-w-md text-sm text-muted-foreground">
          There is no brand profile yet, so the studio does not know what this
          business does. Complete brand onboarding first — otherwise it will
          have to ask you everything before it can write anything.
        </p>
      )}
    </div>
  );
}
