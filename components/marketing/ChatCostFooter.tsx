import { formatUsdCents } from "@/lib/format/currency";

/**
 * What this conversation has cost.
 *
 * Shown always, not on hover and not behind a link. AGENTS.md requires
 * generation costs to be visible, and a chat is the one surface where spend
 * accumulates without any confirmation step in front of it — a per-turn ceiling
 * bounds the damage, but only a running total makes it noticeable.
 *
 * The figure is the reconciled total from the database, so it lags the current
 * turn until that turn settles. That is the honest number: the cost of a reply
 * still being written is not yet known.
 */
export function ChatCostFooter({
  totalCostCents,
  messageCount,
}: {
  totalCostCents: number;
  messageCount: number;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {messageCount} message{messageCount === 1 ? "" : "s"} ·{" "}
      <span className="tabular-nums">{formatUsdCents(totalCostCents)}</span> so
      far
    </p>
  );
}
