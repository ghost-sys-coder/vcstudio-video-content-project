"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { saveMarketingScheduleRuleAction } from "@/app/(authenticated)/app/marketing/schedules/actions";
import { Button } from "@/components/ui/button";
import type { MarketingScheduleRule } from "@/db/schema";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function MarketingScheduleRuleForm({
  rule,
  campaigns,
  defaultTimezone,
}: {
  rule?: MarketingScheduleRule;
  campaigns: { id: string; name: string }[];
  defaultTimezone: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveMarketingScheduleRuleAction(formData);
      if (!result.ok) return setError(result.error);
      router.push("/app/marketing/schedules");
      router.refresh();
    });
  }

  return (
    <form action={save} className="grid max-w-3xl gap-4 rounded-xl border p-4">
      {rule ? <input name="ruleId" type="hidden" value={rule.id} /> : null}
      <label className="grid gap-1 text-sm font-medium">
        Rule name
        <input
          className="h-10 rounded-lg border bg-background px-3"
          defaultValue={rule?.name ?? "Weekly local business growth insight"}
          name="name"
          required
        />
      </label>
      <div className="grid min-w-0 gap-4 sm:grid-cols-3">
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Skill
          <select
            className="h-10 w-full min-w-0 max-w-full rounded-lg border bg-background px-3"
            defaultValue={rule?.skillKey ?? "create_social_post"}
            name="skillKey"
          >
            <option value="create_social_post">Social post</option>
            <option value="create_social_graphic">Social graphic</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Traffic
          <select
            className="h-10 w-full min-w-0 max-w-full rounded-lg border bg-background px-3"
            defaultValue={rule?.trafficType ?? "organic"}
            name="trafficType"
          >
            <option value="organic">Organic</option>
            <option value="paid">Paid</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Campaign (optional)
          <select
            className="h-10 w-full min-w-0 max-w-full truncate rounded-lg border bg-background px-3"
            defaultValue={rule?.campaignId ?? ""}
            name="campaignId"
          >
            <option value="">No campaign</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Platforms</legend>
        <div className="flex flex-wrap gap-4">
          {SOCIAL_POST_PLATFORMS.map((platform) => (
            <label className="flex items-center gap-2 text-sm" key={platform}>
              <input
                defaultChecked={
                  rule
                    ? rule.platforms.includes(platform)
                    : ["instagram", "linkedin"].includes(platform)
                }
                name="platforms"
                type="checkbox"
                value={platform}
              />
              {platform}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-medium">
        Content direction
        <textarea
          className="min-h-32 rounded-lg border bg-background p-3"
          defaultValue={
            rule?.promptBrief ??
            "Share one practical, current website or digital-growth insight for a growing local business. Teach something useful, connect it naturally to our expertise, and finish with a low-pressure invitation to talk. Use uploaded brand media when it genuinely supports the idea."
          }
          name="promptBrief"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium">
          Frequency
          <select
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={rule?.frequency ?? "weekly"}
            name="frequency"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Publication time
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={minutesToTime(rule?.timeOfDayMinutes ?? 9 * 60)}
            name="timeOfDay"
            required
            type="time"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Timezone
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={rule?.timezone ?? defaultTimezone}
            name="timezone"
            required
          />
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Weekly days</legend>
        <div className="flex flex-wrap gap-4">
          {WEEKDAYS.map(([value, label]) => (
            <label className="flex items-center gap-2 text-sm" key={value}>
              <input
                defaultChecked={
                  rule ? rule.byWeekday.includes(value) : value === 3
                }
                name="byWeekday"
                type="checkbox"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Used only for weekly rules.
        </p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="grid gap-1 text-sm font-medium">
          Monthly day
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={rule?.byMonthDay ?? 1}
            max={28}
            min={1}
            name="byMonthDay"
            type="number"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Generate ahead (minutes)
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={rule?.leadTimeMinutes ?? 1440}
            max={43200}
            min={0}
            name="leadTimeMinutes"
            required
            type="number"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Items per run
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={rule?.maxItemsPerRun ?? 1}
            max={10}
            min={1}
            name="maxItemsPerRun"
            required
            type="number"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Monthly cap (cents)
          <input
            className="h-10 rounded-lg border bg-background px-3"
            defaultValue={rule?.monthlyBudgetCents ?? 500}
            min={0}
            name="monthlyBudgetCents"
            type="number"
          />
        </label>
      </div>
      <div className="grid gap-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            className="mt-0.5"
            defaultChecked={rule?.isBranded ?? true}
            name="isBranded"
            type="checkbox"
          />
          Use the compiled brand context.
        </label>
        <label className="flex items-start gap-2">
          <input
            className="mt-0.5"
            defaultChecked={rule?.autoSchedule ?? true}
            name="autoSchedule"
            type="checkbox"
          />
          After an owner/editor approves the draft, hand it to Social and
          schedule it for the proposed time when an active platform account is
          available.
        </label>
      </div>
      <p className="rounded-lg border border-notice-info-edge bg-notice-info p-3 text-xs text-notice-info-foreground">
        Saving enables this rule. It generates only when workspace autonomy is
        Assisted. Every result still requires approval; automatic approval is
        not available in this slice.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {rule ? "Save and enable rule" : "Create recurring rule"}
      </Button>
    </form>
  );
}
