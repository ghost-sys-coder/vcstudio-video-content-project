"use client";

import { useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BuildTimelineButton({
  status,
  errorCount,
  onBuild,
}: {
  status: "ready" | "invalid";
  errorCount: number;
  onBuild: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        disabled={pending}
        onClick={() => startTransition(async () => onBuild())}
        type="button"
        variant="outline"
      >
        <RefreshCwIcon aria-hidden className={pending ? "animate-spin" : ""} />
        {pending ? "Validating…" : "Validate timeline"}
      </Button>
      <span className="text-xs text-muted-foreground">
        {status === "ready"
          ? "All assets present."
          : `${errorCount} blocking issue${errorCount === 1 ? "" : "s"}.`}
      </span>
    </div>
  );
}
