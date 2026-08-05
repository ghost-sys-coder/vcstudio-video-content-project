import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import type { MarketingChatToolResultData } from "@/lib/schemas/marketing-chat-message";

export function ChatDeferredResultCard({
  result,
}: {
  result: MarketingChatToolResultData;
}) {
  const Icon = result.failed ? CircleAlert : CircleCheck;
  return (
    <div className="rounded-md border border-border bg-muted/50 px-3 py-3 text-sm">
      <p className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{result.summary}</span>
      </p>
      {result.contentItemId ? (
        <Link
          className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
          href={`/app/marketing/content/${result.contentItemId}`}
        >
          Open review item
        </Link>
      ) : null}
      {result.projectId ? (
        <Link
          className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
          href={`/app/projects/${result.projectId}/storyboard`}
        >
          Open storyboard
        </Link>
      ) : null}
      {result.campaignId ? (
        <Link
          className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
          href={`/app/marketing/campaigns/${result.campaignId}`}
        >
          Open campaign
        </Link>
      ) : null}
    </div>
  );
}
