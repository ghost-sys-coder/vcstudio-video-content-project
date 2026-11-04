import { Monitor, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { getMcpClientName } from "@/lib/mcp/settings-presentation";
import type { McpSettingsView } from "@/lib/mcp/settings-view";
import { McpGrantForm } from "./McpGrantForm";
import { McpRevokeDialog } from "./McpRevokeDialog";

export function McpConnectionCard({
  connection,
  workspaces,
  activeWorkspaceId,
}: {
  connection: McpSettingsView["connections"][number];
  workspaces: McpSettingsView["workspaces"];
  activeWorkspaceId: string;
}) {
  return (
    <Card
      className="min-w-0 self-start"
      aria-labelledby={`connection-${connection.id}`}
    >
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
              {connection.revoked ? (
                <Unplug aria-hidden="true" className="size-5" />
              ) : (
                <Monitor aria-hidden="true" className="size-5" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h3
                id={`connection-${connection.id}`}
                className="break-words text-base font-semibold"
              >
                {getMcpClientName(connection.clientId)}
              </h3>
              <p className="text-xs text-muted-foreground">
                Workspace access and permissions
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              connection.revoked
                ? "bg-muted text-muted-foreground"
                : "border-notice-ready-edge bg-notice-ready text-notice-ready-foreground"
            }
          >
            {connection.revoked ? "Disconnected" : "Connected"}
          </Badge>
        </div>
        <p className="mt-3 break-all font-mono text-xs leading-relaxed text-muted-foreground">
          {connection.clientId}
        </p>
      </CardHeader>
      <CardContent>
        <McpGrantForm
          connection={connection}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
      </CardContent>
      {!connection.revoked && (
        <CardFooter className="justify-end">
          <McpRevokeDialog connectionId={connection.id} />
        </CardFooter>
      )}
    </Card>
  );
}
