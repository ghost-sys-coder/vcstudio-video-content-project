import { cn } from "@/lib/utils";

export function AudioDurationDisplay({
  durationMilliseconds,
  frames,
  className,
}: {
  durationMilliseconds: number | null;
  frames?: number | null;
  className?: string;
}) {
  if (durationMilliseconds === null)
    return (
      <span
        className={cn("font-mono text-xs text-muted-foreground", className)}
      >
        —
      </span>
    );

  const seconds = durationMilliseconds / 1000;
  const label =
    seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`
      : `${seconds.toFixed(1)}s`;

  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums text-muted-foreground",
        className,
      )}
    >
      {label}
      {typeof frames === "number" ? (
        <span className="ml-1 opacity-70">· {frames}f</span>
      ) : null}
    </span>
  );
}
