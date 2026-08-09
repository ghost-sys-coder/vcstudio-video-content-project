import type { WorkspaceRole } from "@/db/schema";
import type { FirstValueFacts } from "@/db/repositories/first-value-onboarding.repository";

export type FirstValueMilestone = {
  id: string;
  label: string;
  complete: boolean;
  href: string;
  optional?: boolean;
  blocked?: boolean;
};
export type FirstValueTrack = {
  id: "video" | "marketing" | "social";
  title: string;
  description: string;
  milestones: FirstValueMilestone[];
  completedCount: number;
  totalCount: number;
};

export function buildFirstValueTracks(input: {
  facts: FirstValueFacts;
  role: WorkspaceRole;
  marketingEnabled: boolean;
  publishingEnabled: boolean;
}): FirstValueTrack[] {
  const observeOnly = input.role === "viewer";
  const tracks: FirstValueTrack[] = [
    {
      id: "video",
      title: "Video production",
      description: "Create and finish the first reviewable video output.",
      milestones: [
        {
          id: "budget",
          label: "Configure a workspace budget",
          complete: input.facts.budgetConfigured,
          href: "/app/usage",
          blocked: observeOnly && !input.facts.budgetConfigured,
        },
        {
          id: "project",
          label: "Create the first project",
          complete: input.facts.projectCreated,
          href: "/app/projects",
          blocked: observeOnly && !input.facts.projectCreated,
        },
        {
          id: "asset",
          label: "Approve the first image or narration asset",
          complete: input.facts.assetApproved,
          href: "/app/projects",
          blocked: observeOnly && !input.facts.assetApproved,
        },
        {
          id: "render",
          label: "Complete the first render",
          complete: input.facts.renderCompleted,
          href: "/app/projects",
          blocked: observeOnly && !input.facts.renderCompleted,
        },
      ],
      completedCount: 0,
      totalCount: 0,
    },
    {
      id: "marketing",
      title: "Marketing Studio",
      description: "Ground the workspace brand and create the first draft.",
      milestones: [
        {
          id: "brand",
          label: "Complete the brand profile",
          complete: input.facts.brandComplete,
          href: "/app/marketing/brand/onboarding",
          blocked:
            !input.marketingEnabled ||
            (observeOnly && !input.facts.brandComplete),
        },
        {
          id: "google",
          label: "Connect Google Business Profile",
          complete: input.facts.googleBusinessConnected,
          href: "/app/marketing/integrations",
          optional: true,
          blocked: !input.marketingEnabled || observeOnly,
        },
        {
          id: "draft",
          label: "Create the first marketing draft",
          complete: input.facts.marketingDraftCreated,
          href: "/app/marketing/content",
          blocked:
            !input.marketingEnabled ||
            (observeOnly && !input.facts.marketingDraftCreated),
        },
      ],
      completedCount: 0,
      totalCount: 0,
    },
    {
      id: "social",
      title: "Social publishing",
      description: "Connect a destination and complete the first publication.",
      milestones: [
        {
          id: "connection",
          label: "Connect a publishing destination",
          complete: input.facts.publishingConnected,
          href: "/app/social/accounts",
          blocked:
            !input.publishingEnabled ||
            (observeOnly && !input.facts.publishingConnected),
        },
        {
          id: "publish",
          label: "Publish the first post",
          complete: input.facts.postPublished,
          href: "/app/social/posts",
          blocked:
            !input.publishingEnabled ||
            (observeOnly && !input.facts.postPublished),
        },
      ],
      completedCount: 0,
      totalCount: 0,
    },
  ];
  return tracks.map((track) => ({
    ...track,
    completedCount: track.milestones.filter(
      (milestone) => milestone.complete && !milestone.optional,
    ).length,
    totalCount: track.milestones.filter((milestone) => !milestone.optional)
      .length,
  }));
}
