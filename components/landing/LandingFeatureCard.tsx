import type { LucideIcon } from "lucide-react";

export function LandingFeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
      <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80">
        <Icon className="size-4" />
      </span>
      <h3 className="mt-5 text-base font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
    </div>
  );
}
