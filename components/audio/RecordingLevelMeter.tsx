"use client";

export function RecordingLevelMeter({
  level,
  active,
}: {
  level: number;
  active: boolean;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, level)) * 100);
  return (
    <div
      aria-label="Microphone input level"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="meter"
    >
      <div
        className={
          active
            ? "h-full rounded-full bg-emerald-500 transition-[width] duration-100"
            : "h-full rounded-full bg-muted-foreground/30"
        }
        style={{ width: `${active ? Math.max(2, percent) : 0}%` }}
      />
    </div>
  );
}
