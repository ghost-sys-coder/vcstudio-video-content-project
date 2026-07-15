import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      aria-label="VCStudio"
      className={cn(
        "relative block h-12 w-40 shrink-0 overflow-hidden rounded-md bg-[#839eb1]",
        className,
      )}
    >
      <Image
        alt="VCStudio"
        className="absolute -left-10 -top-[50px] h-auto max-w-none"
        height={160}
        priority
        src="/assets/logo.png"
        width={240}
      />
    </span>
  );
}
