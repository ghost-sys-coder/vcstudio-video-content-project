"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toggleMarketingScheduleRuleAction } from "@/app/(authenticated)/app/marketing/schedules/actions";
import { Button } from "@/components/ui/button";
import type { MarketingScheduleRule } from "@/db/schema";

export function MarketingScheduleRuleCard({
  rule,
}: {
  rule: MarketingScheduleRule;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function toggle() {
    const formData = new FormData();
    formData.set("ruleId", rule.id);
    formData.set("enabled", String(!rule.isEnabled));
    startTransition(async () => {
      const result = await toggleMarketingScheduleRuleAction(formData);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{rule.name}</h3>
          <p className="text-xs text-muted-foreground">
            {rule.frequency} · {rule.skillKey.replaceAll("_", " ")} ·{" "}
            {rule.platforms.join(", ")}
          </p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs">
          {rule.isEnabled ? "enabled" : "paused"}
        </span>
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">
        {rule.promptBrief}
      </p>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Next generation</dt>
          <dd>{rule.nextRunAt?.toLocaleString() ?? "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Per-rule ceiling</dt>
          <dd>
            {rule.monthlyBudgetCents === null
              ? "Workspace budget"
              : `$${(rule.monthlyBudgetCents / 100).toFixed(2)} / month`}
          </dd>
        </div>
      </dl>
      {rule.pausedReason ? (
        <p className="text-xs text-destructive">{rule.pausedReason}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          nativeButton={false}
          render={<Link href={`/app/marketing/schedules?edit=${rule.id}`} />}
          size="sm"
          variant="outline"
        >
          Edit
        </Button>
        <Button disabled={pending} onClick={toggle} size="sm" variant="ghost">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {rule.isEnabled ? "Pause" : "Resume"}
        </Button>
      </div>
    </article>
  );
}
