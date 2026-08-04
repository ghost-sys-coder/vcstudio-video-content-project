"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatUsdCents } from "@/lib/format/currency";

export type ChatThreadRowData = {
  id: string;
  title: string;
  messageCount: number;
  totalCostCents: number;
};

export function ChatThreadRow({ thread }: { thread: ChatThreadRowData }) {
  const pathname = usePathname();
  const href = `/app/marketing/chat/${thread.id}`;
  const active = pathname === href;

  return (
    <li>
      <Link
        aria-current={active ? "page" : undefined}
        className={cn(
          "block rounded-lg px-3 py-2 text-sm transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        )}
        href={href}
      >
        <span className="block truncate">{thread.title}</span>
        <span className="block text-xs text-muted-foreground">
          {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
          {thread.totalCostCents > 0
            ? ` · ${formatUsdCents(thread.totalCostCents)}`
            : ""}
        </span>
      </Link>
    </li>
  );
}
