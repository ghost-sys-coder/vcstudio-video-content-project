import { cn } from "@/lib/utils";

export function LandingSectionHeading({
  eyebrow,
  title,
  description,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: "default" | "inverted";
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p
        className={cn(
          "font-mono text-xs uppercase tracking-[0.22em]",
          tone === "inverted" ? "text-white/50" : "text-muted-foreground",
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl",
          tone === "inverted" ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-4 text-base leading-7",
          tone === "inverted" ? "text-white/60" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
    </div>
  );
}
