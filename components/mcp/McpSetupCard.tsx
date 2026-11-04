import { ArrowRight, Link2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/CopyButton";

const steps = [
  {
    title: "Add VCStudio",
    description: "Create a custom remote MCP connection in ChatGPT or Claude.",
  },
  {
    title: "Sign in",
    description:
      "Choose OAuth and sign in with your existing VCStudio account.",
  },
  {
    title: "Grant access",
    description: "Return here to choose a workspace and its permissions.",
  },
];

export function McpSetupCard({
  endpoint,
  enabled,
}: {
  endpoint: string;
  enabled: boolean;
}) {
  return (
    <Card id="mcp-setup" className="min-w-0">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/20">
          <Link2 aria-hidden="true" className="size-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          Connect an AI application
        </h2>
        <CardDescription className="max-w-lg leading-relaxed">
          Use your VCStudio content from compatible ChatGPT and Claude clients,
          on desktop or the web.
        </CardDescription>
      </CardHeader>
      <CardContent className="app-section">
        <div className="min-w-0 rounded-xl border bg-muted/60 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Connection endpoint
            </p>
            <CopyButton
              value={endpoint}
              label="MCP endpoint"
              className="min-h-8 px-2"
            />
          </div>
          <code className="block break-all font-mono text-sm leading-relaxed">
            {endpoint}
          </code>
        </div>
        <ol
          aria-label="Connection setup steps"
          className="grid gap-4 sm:grid-cols-3"
        >
          {steps.map((step, index) => (
            <li key={step.title} className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                {index < steps.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-auto hidden size-3.5 text-muted-foreground sm:block"
                  />
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
        {!enabled && (
          <p
            role="status"
            className="rounded-xl border border-notice-warning-edge bg-notice-warning p-4 text-sm text-notice-warning-foreground"
          >
            AI connections are paused in this deployment. Existing content
            remains available in VCStudio.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
