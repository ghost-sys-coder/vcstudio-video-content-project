export function getCampaignAutomationPresentation(input: {
  status:
    | "not_started"
    | "pending"
    | "researching"
    | "generating"
    | "completed"
    | "failed";
  completedAt: Date | null;
  contentCount: number;
}) {
  const completed =
    input.status === "completed" &&
    input.completedAt !== null &&
    input.contentCount > 0;
  const legacyEmptyCompletion = input.status === "completed" && !completed;
  return {
    completed,
    canStart:
      input.status === "failed" ||
      input.status === "not_started" ||
      legacyEmptyCompletion,
    label: completed
      ? "completed"
      : legacyEmptyCompletion
        ? "not started"
        : input.status.replace("_", " "),
    message: ["pending", "researching", "generating"].includes(input.status)
      ? "Research and generation are running in the background."
      : completed
        ? "Campaign drafts are ready in the Content and Ads tabs for owner/editor review."
        : input.status === "not_started" || legacyEmptyCompletion
          ? "Automation has not generated any campaign drafts yet."
          : "Campaign automation needs attention.",
  };
}

export function canStartCampaignAutomation(input: {
  status:
    | "not_started"
    | "pending"
    | "researching"
    | "generating"
    | "completed"
    | "failed";
  completedAt: Date | null;
}) {
  return (
    input.status === "failed" ||
    input.status === "not_started" ||
    (input.status === "completed" && input.completedAt === null)
  );
}
