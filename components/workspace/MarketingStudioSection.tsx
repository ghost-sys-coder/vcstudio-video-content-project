"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { setMarketingStudioAccessAction } from "@/app/(authenticated)/app/settings/workspace/actions";

export function MarketingStudioSection({
  enabled,
  deploymentEnabled,
}: {
  enabled: boolean;
  /** False when ENABLE_MARKETING_STUDIO is off; the switch cannot override it. */
  deploymentEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("enabled", String(next));
      const result = await setMarketingStudioAccessAction(data);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(
        next
          ? "Marketing Studio is on for this workspace."
          : "Marketing Studio is off for this workspace.",
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <SparklesIcon aria-hidden className="size-5" />
            Marketing Studio
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The AI marketing team: brand grounding, content drafting, and a
            calendar. It generates with AI, so it spends from this
            workspace&apos;s budget — turn it on only when you want it working.
          </p>
        </div>

        <button
          aria-checked={enabled}
          aria-label="Marketing Studio"
          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-checked:bg-primary aria-[checked=false]:bg-muted"
          disabled={pending || !deploymentEnabled}
          onClick={toggle}
          role="switch"
          type="button"
        >
          {/*
            The knob takes the *foreground* token of whichever track it sits on,
            rather than a fixed `bg-background`. A background-coloured knob is
            nearly invisible on the off-state track — `--background` and
            `--muted` differ by 0.03 lightness in the light theme and about 0.1
            in dark and dim — whereas each `-foreground` token is defined to
            contrast with its own surface in every theme, `.dim` included.
          */}
          <span
            aria-hidden
            className={`pointer-events-none inline-block size-4 rounded-full shadow transition-transform ${
              enabled
                ? "translate-x-6 bg-primary-foreground"
                : "translate-x-1 bg-muted-foreground"
            }`}
          />
        </button>
      </div>

      <p className="mt-4 text-sm" role="status">
        {pending ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2Icon aria-hidden className="size-4 animate-spin" />
            Saving…
          </span>
        ) : enabled ? (
          <span className="text-muted-foreground">
            On. The Studio appears in the sidebar for everyone in this
            workspace.
          </span>
        ) : (
          <span className="text-muted-foreground">
            Off. The Studio is listed in the sidebar but cannot be opened, and
            nothing in it can spend.
          </span>
        )}
      </p>

      {!deploymentEnabled ? (
        <p className="mt-3 rounded-lg border border-notice-info-edge bg-notice-info p-3 text-xs text-notice-info-foreground">
          The Marketing Studio is not available in this deployment. It has to be
          switched on in the server environment before a workspace can use it.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
