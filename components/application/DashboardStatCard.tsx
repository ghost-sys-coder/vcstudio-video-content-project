import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardStatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  href?: string;
  accent?: boolean;
};

export function DashboardStatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  accent = false,
}: DashboardStatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg ring-1 ring-inset",
            accent
              ? "bg-primary/10 text-primary ring-primary/20"
              : "bg-muted text-muted-foreground ring-foreground/10",
          )}
        >
          <Icon aria-hidden className="size-4.5" />
        </span>
        {href ? (
          <ArrowUpRightIcon
            aria-hidden
            className="size-4 text-muted-foreground opacity-0 transition group-hover/stat:opacity-100"
          />
        ) : null}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
    </>
  );

  const className = cn(
    "group/stat rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition",
    href && "hover:-translate-y-0.5 hover:ring-foreground/20 hover:shadow-sm",
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
