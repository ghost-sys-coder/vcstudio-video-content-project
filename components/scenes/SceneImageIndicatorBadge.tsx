import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ImageIcon,
  Loader2Icon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SceneImageIndicator } from "@/lib/scenes/scene-image-indicator";
import { cn } from "@/lib/utils";

const CONFIG: Record<
  Exclude<SceneImageIndicator["state"], "none">,
  { label: string; Icon: LucideIcon; className: string; spin?: boolean }
> = {
  approved: {
    label: "Image approved",
    Icon: CheckCircle2Icon,
    className:
      "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  },
  generated: {
    label: "Image generated",
    Icon: ImageIcon,
    className:
      "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
  },
  generating: {
    label: "Generating image",
    Icon: Loader2Icon,
    className: "bg-primary/10 text-primary ring-primary/20",
    spin: true,
  },
  failed: {
    label: "Image generation failed",
    Icon: AlertTriangleIcon,
    className:
      "bg-destructive/10 text-destructive ring-destructive/20 dark:bg-destructive/20",
  },
};

export function SceneImageIndicatorBadge({
  indicator,
  showLabel = false,
}: {
  indicator: SceneImageIndicator;
  showLabel?: boolean;
}) {
  if (indicator.state === "none") return null;
  const config = CONFIG[indicator.state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
        showLabel && "px-2",
        config.className,
      )}
      title={config.label}
    >
      <config.Icon
        aria-hidden
        className={cn("size-3", config.spin && "animate-spin")}
      />
      {showLabel ? (
        config.label
      ) : (
        <span className="sr-only">{config.label}</span>
      )}
    </span>
  );
}
