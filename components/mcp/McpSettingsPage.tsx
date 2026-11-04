import { Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/Empty";
import type { McpSettingsView } from "@/lib/mcp/settings-view";
import { McpSetupCard } from "./McpSetupCard";
import { McpAccessOverview } from "./McpAccessOverview";
import { McpConnectionCard } from "./McpConnectionCard";
import { McpActivityPanel } from "./McpActivityPanel";
export function McpSettingsPage({ data }: { data: McpSettingsView }) {
  return (
    <div className="app-page font-[family-name:var(--font-geist-sans,Arial,sans-serif)]">
      <header className="app-page-header items-center">
        <div className="app-heading max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">
            Workspace settings
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI connections
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Bring your conversations into VCStudio. Connect an AI application,
            choose its workspaces and decide what it can do.
          </p>
        </div>
        <Badge
          variant="outline"
          className={`h-7 gap-2 border px-3 ${data.enabled ? "border-notice-ready-edge bg-notice-ready text-notice-ready-foreground" : "border-notice-warning-edge bg-notice-warning text-notice-warning-foreground"}`}
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current"
          />
          {data.enabled ? "MCP available" : "Deployment paused"}
        </Badge>
      </header>
      <div className="app-grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <McpSetupCard endpoint={data.endpoint} enabled={data.enabled} />
        <McpAccessOverview />
      </div>
      <section aria-labelledby="mcp-connections-title" className="app-section">
        <div className="app-page-header items-center">
          <div className="app-heading">
            <h2
              id="mcp-connections-title"
              className="text-xl font-semibold tracking-tight"
            >
              Your connections
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage workspace permissions for each connected application.
            </p>
          </div>
          <Badge variant="secondary" className="h-6 px-2.5">
            {data.connections.length}{" "}
            {data.connections.length === 1 ? "application" : "applications"}
          </Badge>
        </div>
        {data.connections.length ? (
          <div className="app-grid grid-cols-1 xl:grid-cols-2">
            {data.connections.map((connection) => (
              <McpConnectionCard
                key={connection.id}
                connection={connection}
                workspaces={data.workspaces}
                activeWorkspaceId={data.activeWorkspaceId}
              />
            ))}
          </div>
        ) : (
          <Card className="min-w-0">
            <CardContent>
              <Empty>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
                  <Plug aria-hidden="true" className="size-5" />
                </div>
                <div className="app-heading max-w-md">
                  <h3 className="text-base font-semibold">
                    Your first connection starts here
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Add VCStudio in ChatGPT or Claude using the endpoint above.
                    After signing in, your application will appear here so you
                    can grant workspace access.
                  </p>
                </div>
              </Empty>
            </CardContent>
          </Card>
        )}
      </section>
      <McpActivityPanel
        activity={data.activity}
        workspaceId={data.activeWorkspaceId}
      />
    </div>
  );
}
