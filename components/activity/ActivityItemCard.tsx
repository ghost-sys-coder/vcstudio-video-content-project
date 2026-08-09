import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ActivityAcknowledgeButton } from "@/components/activity/ActivityAcknowledgeButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActivityItem } from "@/db/repositories/activity.repository";

export function ActivityItemCard({
  item,
  workspaceId,
}: {
  item: ActivityItem;
  workspaceId: string;
}) {
  return (
    <article
      className={`rounded-2xl border bg-card p-5 shadow-sm ${item.acknowledged ? "opacity-70" : "border-l-4 border-l-primary"}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                item.severity === "critical"
                  ? "destructive"
                  : item.severity === "warning"
                    ? "outline"
                    : "secondary"
              }
            >
              {item.category.replaceAll("_", " ")}
            </Badge>
            {item.acknowledged ? (
              <Badge variant="ghost">Acknowledged</Badge>
            ) : (
              <Badge>Unread</Badge>
            )}
          </div>
          <h2 className="font-semibold">{item.title}</h2>
          <p className="text-sm text-muted-foreground">{item.detail}</p>
          <time
            className="block text-xs text-muted-foreground"
            dateTime={item.occurredAt.toISOString()}
          >
            {item.occurredAt.toLocaleString()}
          </time>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            nativeButton={false}
            size="sm"
            variant="outline"
            render={<Link href={item.href} />}
          >
            <ArrowUpRight />
            Open
          </Button>
          {!item.acknowledged ? (
            <ActivityAcknowledgeButton
              activityKey={item.key}
              workspaceId={workspaceId}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}
