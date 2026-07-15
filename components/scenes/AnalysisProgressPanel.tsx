"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SceneAnalysisRun } from "@/db/schema";

export function AnalysisProgressPanel({ run }: { run: SceneAnalysisRun }) {
  const router = useRouter();
  useEffect(() => {
    if (!["pending", "queued", "running"].includes(run.status)) return;
    const timer = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [router, run.status]);
  return (
    <section aria-live="polite" className="rounded-xl border bg-muted/30 p-4">
      <div className="flex justify-between text-sm">
        <span className="font-medium">Analysis {run.status}</span>
        <span>{run.progressPercent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${run.progressPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Model {run.model} · estimated $
        {(run.estimatedCostCents / 100).toFixed(2)}
        {run.actualCostCents !== null
          ? ` · actual $${(run.actualCostCents / 100).toFixed(2)}`
          : ""}
      </p>
    </section>
  );
}
