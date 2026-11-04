import { Badge } from "@/components/ui/badge";
import { McpGrantForm } from "./McpGrantForm";
import { McpRevokeDialog } from "./McpRevokeDialog";
import type { McpSettingsView } from "@/lib/mcp/settings-view";
export function McpSettingsPage({ data }: { data: McpSettingsView }) {
  return (
    <div className="app-page">
      <header className="app-page-header">
        <div className="app-heading">
          <h1 className="text-2xl font-semibold">AI connections</h1>
          <p className="text-muted-foreground">
            Use VCStudio from compatible ChatGPT and Claude clients. You choose
            the workspaces and permissions.
          </p>
        </div>
        <Badge variant="outline">
          {data.enabled ? "MCP available" : "Deployment paused"}
        </Badge>
      </header>
      <section className="app-panel app-section">
        <h2 className="font-semibold">Connect an AI application</h2>
        <p>
          Add a custom remote MCP connection in your AI application, use OAuth
          sign-in, then return here to grant workspace permissions.
        </p>
        <p className="break-all rounded-lg bg-muted p-3 font-mono text-sm">
          {data.endpoint}
        </p>
        <p className="text-sm text-muted-foreground">
          File transfer and interactive reviews depend on client support. Secure
          upload and browser review are available as fallbacks. Marketing Studio
          remains paused.
        </p>
        {!data.enabled && (
          <p role="status">
            MCP is disabled in this deployment. Complete the database and Clerk
            OAuth setup before enabling it.
          </p>
        )}
      </section>
      <section className="app-section">
        <h2 className="text-lg font-semibold">Your connections</h2>
        {data.connections.length === 0 ? (
          <p className="text-muted-foreground">
            No AI connections yet. After OAuth sign-in, ask the assistant to
            check its VCStudio connection.
          </p>
        ) : (
          <div className="app-grid">
            {data.connections.map((c) => (
              <article key={c.id} className="app-panel app-section">
                <div className="app-heading">
                  <h3 className="break-all font-medium">{c.clientId}</h3>
                  <p className="text-sm text-muted-foreground">
                    {c.revoked
                      ? "Disconnected"
                      : "Connected identity · workspace grants required"}
                  </p>
                </div>
                <McpGrantForm
                  connection={c}
                  workspaces={data.workspaces}
                  activeWorkspaceId={data.activeWorkspaceId}
                />
                {!c.revoked && <McpRevokeDialog connectionId={c.id} />}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="app-section">
        <h2 className="text-lg font-semibold">
          Recent activity in this workspace
        </h2>
        {data.activity.length ? (
          <ul className="divide-y rounded-xl border">
            {data.activity.map((a) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 p-4"
                key={a.id}
              >
                <span>{a.kind.replaceAll("_", " ")}</span>
                <span className="text-sm text-muted-foreground">
                  {a.status} ·{" "}
                  {new Date(a.createdAt).toLocaleDateString("en-GB", {
                    timeZone: "UTC",
                  })}
                </span>
                {a.error && (
                  <p className="w-full text-sm text-destructive">{a.error}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            No MCP activity recorded here yet.
          </p>
        )}
      </section>
    </div>
  );
}
