import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Gauge } from "lucide-react";
import { BudgetProgressRow } from "./BudgetProgressRow";

export function BudgetProgress({
  dayToDateCents,
  dailyBudgetCents,
  monthToDateCents,
  monthlyBudgetCents,
}: {
  dayToDateCents: number;
  dailyBudgetCents: number;
  monthToDateCents: number;
  monthlyBudgetCents: number;
}) {
  return (
    <Card className="min-w-0 bg-secondary/25 shadow-none">
      <CardHeader className="border-b">
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/20">
          <Gauge aria-hidden="true" className="size-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Budget usage</h2>
        <CardDescription>
          Settled spend and pending reservations count toward your workspace
          budgets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <BudgetProgressRow
          label="Today"
          spentCents={dayToDateCents}
          budgetCents={dailyBudgetCents}
        />
        <BudgetProgressRow
          label="This month"
          spentCents={monthToDateCents}
          budgetCents={monthlyBudgetCents}
        />
      </CardContent>
    </Card>
  );
}
