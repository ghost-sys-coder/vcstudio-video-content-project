import {
  AudioLinesIcon,
  CaptionsIcon,
  FileTextIcon,
  FilmIcon,
  ImageIcon,
  LayersIcon,
  type LucideIcon,
} from "lucide-react";
import { LandingHeroMockupStage } from "@/components/landing/LandingHeroMockupStage";

const STAGES: { icon: LucideIcon; label: string }[] = [
  { icon: FileTextIcon, label: "Script" },
  { icon: LayersIcon, label: "Scenes" },
  { icon: ImageIcon, label: "Storyboard" },
  { icon: AudioLinesIcon, label: "Audio" },
  { icon: CaptionsIcon, label: "Subtitles" },
  { icon: FilmIcon, label: "Render" },
];

export function LandingHeroMockup() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl px-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 top-10 -z-10 h-64 rounded-full bg-[#839eb1]/25 blur-3xl"
      />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e13] shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-yellow-500/70" />
          <span className="size-2.5 rounded-full bg-green-500/70" />
          <p className="mx-auto font-mono text-[11px] text-white/40">
            vcstudio.app/projects/storyboard
          </p>
        </div>
        <div className="p-6 sm:p-10">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {STAGES.map((stage) => (
              <LandingHeroMockupStage
                icon={stage.icon}
                key={stage.label}
                label={stage.label}
              />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-white/60">
              Every stage above reserves its estimated cost before it runs
            </p>
            <p className="font-mono text-xs text-white/40">
              reserve → run → reconcile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
