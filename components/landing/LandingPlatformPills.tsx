const PLATFORMS = [
  "TikTok",
  "YouTube",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "X",
];

export function LandingPlatformPills() {
  return (
    <div className="mt-14 flex flex-col items-center gap-3">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border bg-muted/30 p-1 sm:rounded-full">
        {PLATFORMS.map((platform, index) => (
          <span
            className={
              index === 0
                ? "rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
                : "rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground"
            }
            key={platform}
          >
            {platform}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Plan for each destination, then tailor the final caption before it
        ships.
      </p>
    </div>
  );
}
