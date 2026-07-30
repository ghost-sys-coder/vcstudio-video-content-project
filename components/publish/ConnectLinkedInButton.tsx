import { LinkedInMarkIcon } from "@/components/brand/LinkedInMarkIcon";
import { cn } from "@/lib/utils";

export function ConnectLinkedInButton({
  className,
  disabled = false,
  label = "Connect LinkedIn",
}: {
  className?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <a
      aria-disabled={disabled}
      className={cn(
        "group relative inline-flex items-center gap-2.5 overflow-hidden rounded-lg border border-[#004182] bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white",
        "shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[transform,box-shadow,background-color] duration-200",
        "hover:-translate-y-0.5 hover:bg-[#004182] active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:shadow-none",
        className,
      )}
      href={disabled ? undefined : "/api/linkedin/authorize"}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-white/15 transition-colors group-hover:bg-white/25">
        <LinkedInMarkIcon className="size-4" />
      </span>
      <span>{label}</span>
    </a>
  );
}
