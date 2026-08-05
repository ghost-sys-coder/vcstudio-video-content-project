import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { MarketingContentEditor } from "@/components/marketing/MarketingContentEditor";
import { MarketingContentMediaReview } from "@/components/marketing/MarketingContentMediaReview";
import { MarketingContentReviewActions } from "@/components/marketing/MarketingContentReviewActions";
import { MarketingContentRevisionList } from "@/components/marketing/MarketingContentRevisionList";
import { MarketingContentStatusBadge } from "@/components/marketing/MarketingContentStatusBadge";
import {
  findMarketingContentItem,
  listMarketingContentRevisions,
} from "@/db/repositories/marketing-content.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingContentMediaView } from "@/lib/marketing/content/marketing-content-media-view";
import { can } from "@/lib/policies/workspace-policy";
const paramsSchema = z.object({ contentItemId: z.uuid() });
export default async function MarketingContentDetailPage({
  params,
}: {
  params: Promise<{ contentItemId: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "approveMarketingContent"))
    redirect("/app/access-denied");
  const input = {
    workspaceId: context.activeMembership.workspaceId,
    contentItemId: parsed.data.contentItemId,
  };
  const [item, revisions, media] = await Promise.all([
    findMarketingContentItem(input),
    listMarketingContentRevisions(input),
    loadMarketingContentMediaView(input),
  ]);
  if (!item) notFound();
  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <main className="space-y-5">
        <Link
          className="text-sm text-muted-foreground"
          href="/app/marketing/content"
        >
          ← Content queue
        </Link>
        {media.length === 0 ? (
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {item.kind.replaceAll("_", " ")} ·{" "}
                {item.platform ?? "No platform"}
              </p>
              <h1 className="text-2xl font-semibold">{item.title}</h1>
            </div>
            <MarketingContentStatusBadge status={item.status} />
          </header>
        ) : null}
        <MarketingContentMediaReview
          assets={media}
          body={item.bodyPlainText}
          expectsGraphic={item.kind === "graphic"}
          kind={item.kind}
          platform={item.platform}
          status={item.status}
          title={item.title}
        />
        <MarketingContentEditor item={item} />
      </main>
      <aside className="space-y-6">
        <section className="rounded-xl border p-4">
          <h2 className="mb-3 font-medium">Review</h2>
          <MarketingContentReviewActions item={item} />
          {item.socialPostId ? (
            <Link
              className="text-sm underline"
              href={`/app/social/posts/${item.socialPostId}`}
            >
              Open Social post
            </Link>
          ) : null}
          {typeof item.structuredPayload?.projectId === "string" ? (
            <Link
              className="mt-3 block text-sm underline"
              href={`/app/projects/${item.structuredPayload.projectId}/storyboard`}
            >
              Open video storyboard
            </Link>
          ) : null}
        </section>
        <section>
          <h2 className="mb-3 font-medium">History</h2>
          <MarketingContentRevisionList revisions={revisions} />
        </section>
      </aside>
    </div>
  );
}
