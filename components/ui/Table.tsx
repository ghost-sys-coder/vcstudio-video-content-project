import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The shadcn Table container; its native table sections keep semantic markup. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full min-w-0 overflow-x-auto rounded-xl border"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm [&_th]:h-11 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:font-medium [&_td]:px-4 [&_td]:py-3 [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/35",
          className,
        )}
        {...props}
      />
    </div>
  );
}
