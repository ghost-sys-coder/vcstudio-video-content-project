"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { saveMarketingSettingsAction } from "@/app/(authenticated)/app/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AUTONOMY_LEVEL_DESCRIPTIONS,
  AUTONOMY_LEVEL_LABELS,
} from "@/lib/marketing/autonomy-labels";
import {
  MAX_DAILY_GENERATED_ITEMS,
  MAX_RESEARCH_REFRESH_DAYS,
  SELECTABLE_AUTONOMY_LEVELS,
  type MarketingSettingsInput,
} from "@/lib/schemas/marketing-settings";

/**
 * How much the studio may do on its own, and within what ceilings.
 *
 * The autonomy choice is a radio group rather than a select because the three
 * levels differ in what they permit rather than in degree — the consequence of
 * each has to be readable without opening a menu.
 */
export function MarketingSettingsForm({
  canEdit,
  settings,
}: {
  canEdit: boolean;
  settings: MarketingSettingsInput;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await saveMarketingSettingsAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <form action={save} className="space-y-6">
      <fieldset className="space-y-3" disabled={!canEdit || pending}>
        <legend className="text-sm font-medium">Autonomy</legend>
        {SELECTABLE_AUTONOMY_LEVELS.map((level) => (
          <Label
            className="flex items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary/50 has-[:checked]:bg-accent"
            key={level}
          >
            <input
              className="mt-1"
              defaultChecked={settings.autonomyLevel === level}
              name="autonomyLevel"
              type="radio"
              value={level}
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {AUTONOMY_LEVEL_LABELS[level]}
              </span>
              <span className="block text-xs text-muted-foreground">
                {AUTONOMY_LEVEL_DESCRIPTIONS[level]}
              </span>
            </span>
          </Label>
        ))}
        <p className="rounded-lg border border-notice-info-edge bg-notice-info px-2.5 py-2 text-xs text-notice-info-foreground">
          {AUTONOMY_LEVEL_LABELS.autonomous}:{" "}
          {AUTONOMY_LEVEL_DESCRIPTIONS.autonomous}
        </p>
      </fieldset>

      <fieldset className="space-y-4" disabled={!canEdit || pending}>
        <legend className="text-sm font-medium">Publishing</legend>
        <Label className="flex items-start gap-3 text-sm">
          <input
            className="mt-1"
            defaultChecked={settings.requireApprovalBeforePublish}
            name="requireApprovalBeforePublish"
            type="checkbox"
          />
          <span>
            <span className="block">Require approval before publishing</span>
            <span className="block text-xs text-muted-foreground">
              Leave this on unless you have read what the autonomous level does.
            </span>
          </span>
        </Label>
        <Label className="flex items-start gap-3 text-sm">
          <input
            className="mt-1"
            defaultChecked={settings.brandedDefault}
            name="brandedDefault"
            type="checkbox"
          />
          <span>
            <span className="block">Default new content to branded</span>
            <span className="block text-xs text-muted-foreground">
              Unbranded content can still be requested per item.
            </span>
          </span>
        </Label>
      </fieldset>

      <fieldset
        className="grid gap-4 sm:grid-cols-2"
        disabled={!canEdit || pending}
      >
        <legend className="text-sm font-medium">Defaults and ceilings</legend>
        <div className="space-y-2">
          <Label htmlFor="marketing-timezone">Time zone</Label>
          <Input
            defaultValue={settings.defaultTimezone}
            id="marketing-timezone"
            name="defaultTimezone"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="marketing-language">Language</Label>
          <Input
            defaultValue={settings.defaultLanguage}
            id="marketing-language"
            name="defaultLanguage"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="marketing-budget">
            Monthly marketing ceiling (cents)
          </Label>
          <Input
            defaultValue={settings.monthlyMarketingBudgetCents ?? ""}
            id="marketing-budget"
            inputMode="numeric"
            min={0}
            name="monthlyMarketingBudgetCents"
            placeholder="No marketing-specific ceiling"
            type="number"
          />
          <p className="text-xs text-muted-foreground">
            A ceiling <em>inside</em> the workspace budget, not a second budget.
            Leave empty to use the workspace budget alone.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="marketing-daily-items">
            Most items generated per day
          </Label>
          <Input
            defaultValue={settings.dailyMaxGeneratedItems}
            id="marketing-daily-items"
            inputMode="numeric"
            max={MAX_DAILY_GENERATED_ITEMS}
            min={1}
            name="dailyMaxGeneratedItems"
            required
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="marketing-research-days">
            Refresh research after (days)
          </Label>
          <Input
            defaultValue={settings.researchRefreshDays}
            id="marketing-research-days"
            inputMode="numeric"
            max={MAX_RESEARCH_REFRESH_DAYS}
            min={1}
            name="researchRefreshDays"
            required
            type="number"
          />
        </div>
      </fieldset>

      {error ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button disabled={pending} type="submit">
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save settings"
            )}
          </Button>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {savedAt ? `Saved at ${savedAt}` : null}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only a workspace owner can change these settings.
        </p>
      )}
    </form>
  );
}
