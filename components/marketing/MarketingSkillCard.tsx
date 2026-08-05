"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteMarketingSkillAction,
  toggleMarketingSkillAction,
} from "@/app/(authenticated)/app/marketing/skills/actions";
import { Button } from "@/components/ui/button";
import type { MarketingSkill } from "@/db/schema";

export function MarketingSkillCard({ skill }: { skill: MarketingSkill }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: "toggle" | "delete") {
    if (
      action === "delete" &&
      !window.confirm(`Delete /${skill.slug}? Existing chat history is kept.`)
    )
      return;
    const formData = new FormData();
    formData.set("skillId", skill.id);
    if (action === "toggle") formData.set("enabled", String(!skill.isEnabled));
    startTransition(async () => {
      const result =
        action === "toggle"
          ? await toggleMarketingSkillAction(formData)
          : await deleteMarketingSkillAction(formData);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <article className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{skill.name}</h3>
          <p className="text-xs text-muted-foreground">/{skill.slug}</p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-xs">
          {skill.isEnabled ? "enabled" : "disabled"}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {skill.description}
      </p>
      <p className="text-xs text-muted-foreground">
        {skill.baseSkillKey.replaceAll("_", " ")} · {skill.inputFields.length}{" "}
        inputs · version {skill.version}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          nativeButton={false}
          render={<Link href={`/app/marketing/skills?edit=${skill.id}`} />}
          size="sm"
          variant="outline"
        >
          Edit
        </Button>
        <Button
          disabled={pending}
          onClick={() => run("toggle")}
          size="sm"
          variant="ghost"
        >
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {skill.isEnabled ? "Disable" : "Enable"}
        </Button>
        <Button
          disabled={pending}
          onClick={() => run("delete")}
          size="sm"
          variant="ghost"
        >
          Delete
        </Button>
      </div>
    </article>
  );
}
