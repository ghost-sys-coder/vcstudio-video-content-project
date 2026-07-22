import { FacebookMarkIcon } from "@/components/brand/FacebookMarkIcon";
import { cn } from "@/lib/utils";

export function ConnectFacebookButton({
  className,
  label = "Connect a Facebook Page",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg bg-[#1877f2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1264d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877f2] focus-visible:ring-offset-2",
        className,
      )}
      href="/api/facebook/authorize"
    >
      <FacebookMarkIcon className="size-5 shrink-0" />
      {label}
    </a>
  );
}
