import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#839eb1] text-sm font-bold text-[#0b0e13]">
        VC
      </span>
      <span className="text-xl font-semibold tracking-tight">Studio</span>
    </span>
  );
}
