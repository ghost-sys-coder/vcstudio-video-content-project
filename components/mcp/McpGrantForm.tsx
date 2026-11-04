"use client";
import { useActionState, useState } from "react";
import { MCP_SCOPES } from "@studio/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { saveMcpGrantAction } from "@/app/(authenticated)/app/settings/mcp/actions";
import type { McpSettingsView } from "@/lib/mcp/settings-view";
import { MCP_SCOPE_LABELS } from "@/lib/mcp/scope-labels";
export function McpGrantForm({
  connection,
  workspaces,
  activeWorkspaceId,
}: {
  connection: McpSettingsView["connections"][number];
  workspaces: McpSettingsView["workspaces"];
  activeWorkspaceId: string;
}) {
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId);
  const [state, action, pending] = useActionState(saveMcpGrantAction, {
    ok: false,
    message: "",
  });
  const selected = workspaces.find((w) => w.workspaceId === workspaceId);
  const saved = connection.grants.find((g) => g.workspaceId === workspaceId)
    ?.scopes ?? ["vcstudio:read"];
  return (
    <form action={action} className="app-section">
      <input type="hidden" name="connectionId" value={connection.id} />
      <div className="app-heading">
        <Label htmlFor={`workspace-${connection.id}`}>Workspace</Label>
        <FormSelect
          id={`workspace-${connection.id}`}
          name="workspaceId"
          value={workspaceId}
          onValueChange={setWorkspaceId}
        >
          {workspaces.map((w) => (
            <SelectItem key={w.workspaceId} value={w.workspaceId}>
              {w.workspaceName} · {w.role}
            </SelectItem>
          ))}
        </FormSelect>
      </div>
      <fieldset key={workspaceId} className="grid gap-3">
        <legend className="mb-3 font-medium">
          Allow this AI connection to
        </legend>
        {MCP_SCOPES.map((scope) => (
          <Label key={scope} className="flex items-center gap-3">
            <Checkbox
              name="scopes"
              value={scope}
              defaultChecked={saved.includes(scope)}
              disabled={pending || !selected?.allowedScopes.includes(scope)}
            />
            {MCP_SCOPE_LABELS[scope]}
          </Label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending
          ? "Saving…"
          : connection.revoked
            ? "Reconnect with these permissions"
            : "Save workspace permissions"}
      </Button>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className="text-sm text-muted-foreground"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
