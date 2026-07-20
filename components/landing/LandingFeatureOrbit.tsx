import {
  AudioLinesIcon,
  CaptionsIcon,
  FileTextIcon,
  FilmIcon,
  LayersIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

const RING_SIZES = [320, 232, 144];
const RADIUS = 128;
const NODES: { icon: LucideIcon; angle: number }[] = [
  { icon: FileTextIcon, angle: -90 },
  { icon: LayersIcon, angle: -30 },
  { icon: UsersIcon, angle: 30 },
  { icon: AudioLinesIcon, angle: 90 },
  { icon: CaptionsIcon, angle: 150 },
  { icon: FilmIcon, angle: 210 },
];

export function LandingFeatureOrbit() {
  return (
    <div className="relative mx-auto h-80 w-80" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-[#839eb1]/20 blur-3xl" />
      {RING_SIZES.map((size) => (
        <div
          className="absolute left-1/2 top-1/2 rounded-full border border-white/10"
          key={size}
          style={{
            height: size,
            width: size,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#0b0e13] shadow-lg">
        <SparklesIcon className="size-5" />
      </span>
      {NODES.map(({ icon: Icon, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * RADIUS;
        const y = Math.sin(rad) * RADIUS;
        return (
          <span
            className="absolute left-1/2 top-1/2 flex size-10 items-center justify-center rounded-full border border-white/15 bg-[#12161c] text-white/80 shadow-lg"
            key={angle}
            style={{
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
          >
            <Icon className="size-4" />
          </span>
        );
      })}
    </div>
  );
}
