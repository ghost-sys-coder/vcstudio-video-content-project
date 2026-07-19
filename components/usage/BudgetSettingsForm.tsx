"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBudgetSettingsAction } from "@/app/(authenticated)/app/usage/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function BudgetSettingsForm({
  workspaceId,
  dailyBudgetCents,
  monthlyBudgetCents,
  manualConfirmationThresholdCents,
}: {
  workspaceId: string;
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  manualConfirmationThresholdCents: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveBudgetSettingsAction(formData);
      if (!result.success) {
        setError(result.error ?? "The budget could not be saved.");
        return;
      }
      setMessage("Budget settings saved.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budgets</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={submit} className="space-y-5">
          <input name="workspaceId" type="hidden" value={workspaceId} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="daily-budget">Daily budget (USD)</Label>
              <Input
                defaultValue={toDollars(dailyBudgetCents)}
                disabled={pending}
                id="daily-budget"
                min="0"
                name="dailyBudgetDollars"
                step="0.01"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-budget">Monthly budget (USD)</Label>
              <Input
                defaultValue={toDollars(monthlyBudgetCents)}
                disabled={pending}
                id="monthly-budget"
                min="0"
                name="monthlyBudgetDollars"
                step="0.01"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-threshold">Confirm above (USD)</Label>
              <Input
                defaultValue={toDollars(manualConfirmationThresholdCents)}
                disabled={pending}
                id="confirm-threshold"
                min="0"
                name="manualConfirmationThresholdDollars"
                step="0.01"
                type="number"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Estimates at or above the confirmation threshold require an explicit
            extra confirmation before spending.
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-emerald-700" role="status">
              {message}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Save budgets"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
