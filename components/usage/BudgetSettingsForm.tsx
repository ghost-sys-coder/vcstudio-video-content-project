"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBudgetSettingsAction } from "@/app/(authenticated)/app/usage/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { formatBudgetDollars } from "@/lib/usage/usage-presentation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      try {
        const result = await saveBudgetSettingsAction(formData);
        if (!result.success) {
          setError(result.error ?? "The budget could not be saved.");
          return;
        }
        setMessage("Budget settings saved.");
        router.refresh();
      } catch {
        setError("The budget could not be saved. Please try again.");
      }
    });
  }

  return (
    <Card className="@container min-w-0 self-start">
      <CardHeader className="border-b">
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-secondary">
          <Wallet aria-hidden="true" className="size-5" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight">Budgets</h3>
        <CardDescription>
          Define spending ceilings and when to ask for extra confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(new FormData(event.currentTarget));
          }}
          className="space-y-5"
        >
          <input name="workspaceId" type="hidden" value={workspaceId} />
          <div className="grid grid-cols-1 items-end gap-4 @sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="daily-budget">Daily budget (USD)</Label>
              <Input
                defaultValue={formatBudgetDollars(dailyBudgetCents)}
                disabled={pending}
                id="daily-budget"
                min="0"
                name="dailyBudgetDollars"
                step="0.01"
                type="number"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="monthly-budget">Monthly budget (USD)</Label>
              <Input
                defaultValue={formatBudgetDollars(monthlyBudgetCents)}
                disabled={pending}
                id="monthly-budget"
                min="0"
                name="monthlyBudgetDollars"
                step="0.01"
                type="number"
              />
            </div>
            <div className="min-w-0 space-y-2 @sm:col-span-2">
              <Label htmlFor="confirm-threshold">Confirm above (USD)</Label>
              <Input
                defaultValue={formatBudgetDollars(
                  manualConfirmationThresholdCents,
                )}
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
            <p
              className="rounded-lg border border-notice-ready-edge bg-notice-ready p-3 text-sm text-notice-ready-foreground"
              role="status"
            >
              {message}
            </p>
          ) : null}
          <Button disabled={pending} type="submit" className="w-full sm:w-auto">
            {pending ? "Saving…" : "Save budgets"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
