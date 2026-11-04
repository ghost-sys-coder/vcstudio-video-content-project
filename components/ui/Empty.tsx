import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Base shadcn Empty container, styled by its surrounding application surface. */
export function Empty({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance",
        className,
      )}
      {...props}
    />
  );
}
