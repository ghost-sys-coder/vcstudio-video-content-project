export type MarketingWeeklyDigestSnapshot = {
  activity: {
    generated: number;
    reviewed: number;
    approved: number;
    rejected: number;
    published: number;
    publicationFailures: number;
    substantiveEditRate: number | null;
    rejectionReasons: { label: string; count: number }[];
  };
  spend: {
    actualCostCents: number;
    budgetRefusals: number;
    capRefusals: number;
  };
  scheduler: { skipped: number; failed: number };
  integrations: {
    connectedChannels: number;
    unhealthyChannels: number;
    googleBusinessStatus: string;
    googleBusinessLastSyncedAt: string | null;
    selectedGoogleBusinessLocations: number;
  };
  upcoming: {
    scheduledContent: number;
    scheduleRuns: number;
  };
  recommendedActions: string[];
};

export function getUtcWeekRange(now: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function buildWeeklyDigestRecommendations(input: {
  generated: number;
  reviewed: number;
  rejected: number;
  schedulerFailures: number;
  unhealthyChannels: number;
  googleBusinessHealthy: boolean;
  upcomingScheduledContent: number;
}): string[] {
  const actions: string[] = [];
  if (input.generated === 0)
    actions.push("Create or enable a bounded content schedule for this week.");
  if (input.generated > input.reviewed)
    actions.push(
      `Review ${input.generated - input.reviewed} generated item(s).`,
    );
  if (input.rejected > 0)
    actions.push(
      "Use rejection reasons to refine the brief or brand guidance.",
    );
  if (input.schedulerFailures > 0)
    actions.push("Resolve failed scheduler runs before the next occurrence.");
  if (input.unhealthyChannels > 0)
    actions.push("Reconnect unhealthy publishing channels.");
  if (!input.googleBusinessHealthy)
    actions.push("Review Google Business Profile connection and sync health.");
  if (input.upcomingScheduledContent === 0)
    actions.push("Confirm the next approved posts have publishing times.");
  return actions.slice(0, 6);
}
