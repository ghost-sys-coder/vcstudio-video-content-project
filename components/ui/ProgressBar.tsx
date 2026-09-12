import { cn } from "@/lib/utils";

/**
 * A measured progress bar.
 *
 * `percent` is deliberately nullable and null renders an indeterminate stripe
 * rather than a bar sitting at zero. A bar at zero claims a measurement of
 * "none done"; an indeterminate one admits there is no measurement yet, and
 * those are different things.
 */
export function ProgressBar({
  className,
  label,
  percent,
}: {
  className?: string;
  /** Describes what is progressing, for assistive technology. */
  label: string;
  percent: number | null;
}) {
  const clamped =
    percent === null ? null : Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      {...(clamped === null ? {} : { "aria-valuenow": clamped })}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      role="progressbar"
    >
      {clamped === null ? (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
      ) : (
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}
