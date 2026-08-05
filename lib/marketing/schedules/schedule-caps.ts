export type ScheduleCapDecision =
  | { allowed: true }
  | { allowed: false; reason: "daily_item_cap" | "monthly_rule_budget" };

export function evaluateScheduleCaps(input: {
  itemsGeneratedToday: number;
  requestedItems: number;
  dailyItemCap: number;
  ruleCommittedCents: number;
  estimatedCostCents: number;
  monthlyRuleBudgetCents: number | null;
}): ScheduleCapDecision {
  if (input.itemsGeneratedToday + input.requestedItems > input.dailyItemCap)
    return { allowed: false, reason: "daily_item_cap" };
  if (
    input.monthlyRuleBudgetCents !== null &&
    input.ruleCommittedCents + input.estimatedCostCents >
      input.monthlyRuleBudgetCents
  )
    return { allowed: false, reason: "monthly_rule_budget" };
  return { allowed: true };
}
