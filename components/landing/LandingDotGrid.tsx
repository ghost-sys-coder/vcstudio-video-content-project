import { cn } from "@/lib/utils";

export function LandingDotGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 text-foreground/8 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_0%,black,transparent)] [-webkit-mask-image:radial-gradient(ellipse_60%_55%_at_50%_0%,black,transparent)]",
        className,
      )}
    />
  );
}
