import type { LucideIcon } from "lucide-react";

export function LandingWorkflowStep({
  index,
  title,
  description,
  icon: Icon,
}: {
  index: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group relative rounded-2xl border bg-background p-6 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#839eb1]/12 text-foreground/70">
          <Icon className="size-4" />
        </span>
        <span className="font-mono text-xs text-muted-foreground">{index}</span>
      </div>
      <h3 className="mt-5 text-base font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
