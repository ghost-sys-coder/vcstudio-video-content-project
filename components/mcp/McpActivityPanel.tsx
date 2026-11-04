import Link from "next/link";
import { Activity, ArrowUpRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/Empty";
import {
  formatMcpActivityDate,
  formatMcpActivityKind,
  MCP_ACTIVITY_STATUSES,
} from "@/lib/mcp/settings-presentation";
import type { McpSettingsView } from "@/lib/mcp/settings-view";

export function McpActivityPanel({
  activity,
  workspaceId,
}: {
  activity: McpSettingsView["activity"];
  workspaceId: string;
}) {
  return (
    <section aria-labelledby="mcp-activity-title">
      <Card className="min-w-0">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="mcp-activity-title"
              className="text-lg font-semibold tracking-tight"
            >
              Recent activity in this workspace
            </h2>
            <Clock3
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          </div>
          <CardDescription>
            Imports, content changes and publication requests from your AI
            connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length ? (
            <ul className="divide-y">
              {activity.map((item) => {
                const status = MCP_ACTIVITY_STATUSES[item.status];
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Activity
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        prefetch={false}
                        href={`/app/mcp/operations/${item.id}?workspaceId=${workspaceId}`}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                      >
                        <span className="break-words">
                          {formatMcpActivityKind(item.kind)}
                        </span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <time dateTime={item.createdAt}>
                          {formatMcpActivityDate(item.createdAt)}
                        </time>
                      </p>
                      {item.error && (
                        <p className="break-words text-sm text-destructive">
                          {item.error}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty className="py-6">
              <Activity
                aria-hidden="true"
                className="size-6 text-muted-foreground"
              />
              <div className="app-heading max-w-md">
                <h3 className="text-sm font-semibold">No activity yet</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Requests from your AI applications will appear here as you use
                  this workspace.
                </p>
              </div>
            </Empty>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
