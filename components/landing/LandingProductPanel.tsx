import { CheckIcon } from "lucide-react";
import type { ProductArea } from "@/lib/landing/landing-content";
import { cn } from "@/lib/utils";

export function LandingProductPanel({ area }: { area: ProductArea }) {
  const Icon = area.icon;
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[1.75rem] border p-7 transition-transform duration-300 hover:-translate-y-1 sm:p-9",
        area.emphasis === "primary"
          ? "bg-[#0b0e13] text-white shadow-[0_24px_70px_rgba(44,60,73,0.16)] lg:col-span-7"
          : "bg-muted/35 lg:col-span-5",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute -right-20 -top-20 size-56 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-80",
          area.emphasis === "primary" ? "bg-[#839eb1]/25" : "bg-primary/8",
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-xl border",
              area.emphasis === "primary"
                ? "border-white/10 bg-white/8 text-white"
                : "bg-background text-foreground",
            )}
          >
            <Icon aria-hidden className="size-5" />
          </span>
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              area.emphasis === "primary"
                ? "text-white/35"
                : "text-muted-foreground",
            )}
          >
            {area.index} / 04
          </span>
        </div>
        <h3 className="mt-8 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
          {area.title}
        </h3>
        <p
          className={cn(
            "mt-3 max-w-xl text-sm leading-6 text-pretty",
            area.emphasis === "primary"
              ? "text-white/60"
              : "text-muted-foreground",
          )}
        >
          {area.description}
        </p>
        <ul className="mt-7 space-y-3">
          {area.capabilities.map((capability) => (
            <li
              className={cn(
                "flex items-start gap-3 text-sm",
                area.emphasis === "primary"
                  ? "text-white/75"
                  : "text-foreground/80",
              )}
              key={capability}
            >
              <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{capability}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
