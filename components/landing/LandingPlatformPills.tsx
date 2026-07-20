const PLATFORMS = ["TikTok", "YouTube", "Instagram", "Facebook"];

export function LandingPlatformPills() {
  return (
    <div className="mt-14 flex flex-col items-center gap-3">
      <div className="flex w-fit items-center gap-1 rounded-full border bg-muted/30 p-1">
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
        Every brief targets one primary platform, so the hook is written for
        where it&rsquo;s going.
      </p>
    </div>
  );
}
