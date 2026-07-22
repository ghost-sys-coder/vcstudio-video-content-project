import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectTikTokButton({
  className,
  disabled = false,
  label = "Connect TikTok",
}: {
  className?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <a
      aria-disabled={disabled}
      className={cn(
        "group relative inline-flex items-center gap-2.5 overflow-hidden rounded-lg border border-black/80 bg-black px-5 py-2.5 text-sm font-semibold text-white",
        "shadow-[3px_3px_0_#25f4ee,-3px_-3px_0_#fe2c55] transition-[transform,box-shadow,background-color] duration-200",
        "hover:-translate-y-0.5 hover:bg-zinc-900 hover:shadow-[4px_4px_0_#25f4ee,-4px_-4px_0_#fe2c55] active:translate-y-0 active:shadow-[2px_2px_0_#25f4ee,-2px_-2px_0_#fe2c55]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:shadow-none",
        className,
      )}
      href={disabled ? undefined : "/api/tiktok/authorize"}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white/15">
        <Music2 aria-hidden className="size-4" />
      </span>
      <span>{label}</span>
    </a>
  );
}
