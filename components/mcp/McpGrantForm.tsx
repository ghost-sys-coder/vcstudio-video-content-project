"use client";
import { useActionState, useState } from "react";
import { MCP_SCOPES, type McpPublicationApprovalMode } from "@studio/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { saveMcpGrantAction } from "@/app/(authenticated)/app/settings/mcp/actions";
import type { McpSettingsView } from "@/lib/mcp/settings-view";
import { MCP_SCOPE_LABELS, MCP_SCOPE_TITLES } from "@/lib/mcp/scope-labels";
import { McpPublicationApprovalField } from "./McpPublicationApprovalField";
import { McpGenerationApprovalField } from "./McpGenerationApprovalField";
import { canConfigureAutonomousGeneration } from "@/lib/mcp/generation-approval-policy";
import { canConfigureAutonomousPublishing } from "@/lib/mcp/publication-approval-policy";
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
  const savedGrant = connection.grants.find(
    (g) => g.workspaceId === workspaceId,
  );
  const saved = savedGrant?.scopes ?? ["vcstudio:read"];
  const [publicationApprovalMode, setPublicationApprovalMode] =
    useState<McpPublicationApprovalMode>(
      savedGrant?.publicationApprovalMode ?? "manual",
    );
  const [generationApprovalMode, setGenerationApprovalMode] =
    useState<McpPublicationApprovalMode>(
      savedGrant?.generationApprovalMode ?? "manual",
    );
  return (
    <form action={action} className="app-section">
      <input type="hidden" name="connectionId" value={connection.id} />
      <div className="app-heading">
        <Label htmlFor={`workspace-${connection.id}`}>Workspace</Label>
        <FormSelect
          id={`workspace-${connection.id}`}
          name="workspaceId"
          value={workspaceId}
          onValueChange={(id) => {
            setWorkspaceId(id);
            setGenerationApprovalMode(
              connection.grants.find((g) => g.workspaceId === id)
                ?.generationApprovalMode ?? "manual",
            );
            setPublicationApprovalMode(
              connection.grants.find((g) => g.workspaceId === id)
                ?.publicationApprovalMode ?? "manual",
            );
          }}
        >
          {workspaces.map((w) => (
            <SelectItem key={w.workspaceId} value={w.workspaceId}>
              {w.workspaceName} · {w.role}
            </SelectItem>
          ))}
        </FormSelect>
      </div>
      <fieldset key={workspaceId} className="min-w-0 space-y-2">
        <legend className="mb-3 text-sm font-medium">Permissions</legend>
        {MCP_SCOPES.map((scope) => (
          <Label
            key={scope}
            className="cursor-pointer items-start gap-3 rounded-xl border border-transparent bg-muted/45 p-3 transition-colors hover:border-border hover:bg-muted has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <Checkbox
              name="scopes"
              value={scope}
              defaultChecked={saved.includes(scope)}
              disabled={pending || !selected?.allowedScopes.includes(scope)}
              className="mt-0.5"
            />
            <span className="min-w-0 space-y-1">
              <span className="block text-sm font-medium leading-snug">
                {MCP_SCOPE_TITLES[scope]}
              </span>
              <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                {MCP_SCOPE_LABELS[scope]}
              </span>
            </span>
          </Label>
        ))}
        <McpPublicationApprovalField
          id={`publication-approval-${connection.id}`}
          value={publicationApprovalMode}
          onChange={setPublicationApprovalMode}
          owner={canConfigureAutonomousPublishing(selected?.role)}
          disabled={pending}
        />
        <McpGenerationApprovalField
          id={`generation-approval-${connection.id}`}
          value={generationApprovalMode}
          onChange={setGenerationApprovalMode}
          owner={canConfigureAutonomousGeneration(selected?.role)}
          disabled={pending}
        />
      </fieldset>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Permissions apply to this workspace. Your workspace role and the
        application&apos;s OAuth consent also limit access.
      </p>
      <Button
        type="submit"
        disabled={pending}
        className="w-full whitespace-normal sm:w-auto sm:self-start"
      >
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
