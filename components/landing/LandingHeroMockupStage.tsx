import type { LucideIcon } from "lucide-react";

export function LandingHeroMockupStage({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-4 text-center">
      <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80">
        <Icon className="size-4" />
      </span>
      <p className="text-[11px] text-white/60">{label}</p>
    </div>
  );
}
