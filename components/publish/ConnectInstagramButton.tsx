import { InstagramMarkIcon } from "@/components/brand/InstagramMarkIcon";
import { cn } from "@/lib/utils";

export function ConnectInstagramButton({
  className,
  label = "Connect Instagram",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg bg-gradient-to-r from-[#833ab4] via-[#e1306c] to-[#f77737] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1306c] focus-visible:ring-offset-2",
        className,
      )}
      href="/api/instagram/authorize"
    >
      <InstagramMarkIcon className="size-5 shrink-0" />
      {label}
    </a>
  );
}
