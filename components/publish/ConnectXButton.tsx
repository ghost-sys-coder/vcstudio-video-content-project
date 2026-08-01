import { XMarkIcon } from "@/components/brand/XMarkIcon";
import { cn } from "@/lib/utils";

export function ConnectXButton({
  className,
  disabled = false,
  label = "Connect X",
}: {
  className?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <a
      aria-disabled={disabled}
      className={cn(
        "group relative inline-flex items-center gap-2.5 overflow-hidden rounded-lg border border-black bg-black px-5 py-2.5 text-sm font-semibold text-white",
        "shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[transform,box-shadow,background-color] duration-200",
        "hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:shadow-none",
        // Black on black in dark mode reads as a missing button, so the border
        // carries the shape there.
        "dark:border-neutral-700",
        className,
      )}
      // `/api/x/` rather than `/api/twitter/`: the redirect URI is registered in
      // X's developer console and must match byte for byte.
      href={disabled ? undefined : "/api/x/authorize"}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-colors group-hover:bg-white/25">
        <XMarkIcon className="size-3.5" />
      </span>
      <span>{label}</span>
    </a>
  );
}
