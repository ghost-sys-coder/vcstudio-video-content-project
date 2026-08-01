import { PlatformMarkIcon } from "@/components/brand/PlatformMarkIcon";
import type { ContentPlatform } from "@/db/schema";
import { PLATFORM_BRAND_BACKGROUND_CLASS } from "@/lib/platforms/platform-brand";
import { cn } from "@/lib/utils";

/**
 * A connect affordance shaped like the connected-account chips it sits beside.
 *
 * The full-size branded buttons (`ConnectXButton` and friends) are right where a
 * connection is the primary action — workspace settings, and the publish panel's
 * account row. Beside a row of small account chips they are not: a black
 * `Connect X` slab next to a 24px pill reads as a different kind of control
 * entirely. Same destination, same brand mark, borrowed geometry.
 *
 * Dashed rather than solid, so "not connected yet" is distinguishable from a
 * connected account at a glance and not only by reading the label.
 */
export function ConnectPlatformChip({
  className,
  href,
  label,
  platform,
}: {
  className?: string;
  href: string;
  label: string;
  platform: ContentPlatform;
}) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-dashed bg-background py-1 pl-1 pr-3 text-xs font-medium",
        "transition-colors hover:border-solid hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      href={href}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-white",
          PLATFORM_BRAND_BACKGROUND_CLASS[platform],
        )}
      >
        <PlatformMarkIcon className="size-3" platform={platform} />
      </span>
      <span>{label}</span>
    </a>
  );
}
