"use client";

import { LoaderCircle, MessageSquareShare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPostFromRenderAction } from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { ConnectLinkedInButton } from "@/components/publish/ConnectLinkedInButton";
import { SocialPostAccountList } from "@/components/publish/SocialPostAccountList";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_QUICK_COMMENTARY_LENGTH } from "@/lib/schemas/social-post";
import { groupRendersByKind } from "@/lib/publishing/group-renders";
import type {
  PublishableRenderView,
  PublishingView,
} from "@/lib/publishing/publishing-view";

/**
 * Shares a finished render as a social post — the only path to LinkedIn, which
 * takes posts rather than video uploads and so never appears in the channel
 * picker above.
 *
 * Creates a draft and opens the composer rather than publishing here. The
 * composer already owns destination selection, the per-platform character
 * counters, the flattened-text preview, and scheduling; duplicating any of that
 * would give the capability matrix a second place to disagree with itself.
 */
export function ShareRenderAsPostPanel({
  canCompose,
  canManageConnections,
  data,
  projectId,
}: {
  canCompose: boolean;
  canManageConnections: boolean;
  data: PublishingView;
  projectId: string;
}) {
  const router = useRouter();
  const postableRenders = data.renders.filter((render) => !render.tooLarge);
  const [renderId, setRenderId] = useState<string>(
    postableRenders[0]?.id ?? "",
  );
  const [commentary, setCommentary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const renderItems = Object.fromEntries(
    postableRenders.map((render) => [render.id, render.label]),
  );
  const groups = groupRendersByKind(postableRenders);

  function create() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("renderId", renderId);
      formData.set("commentary", commentary);
      const result = await createPostFromRenderAction(formData);
      if (result.ok) router.push(`/app/social/posts/${result.postId}`);
      else setError(result.error);
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Share as a social post</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Post a finished render to LinkedIn, Facebook, or Instagram. LinkedIn
          accepts posts rather than video uploads, so this is how it is reached.
        </p>
      </div>

      {!data.socialPostingEnabled ? (
        <p className="text-xs text-muted-foreground">
          Social posting is currently disabled.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              Post-capable accounts
            </h3>
            <SocialPostAccountList connections={data.socialPostConnections} />
            {canManageConnections &&
            !data.socialPostConnections.some(
              (connection) => connection.platform === "linkedin",
            ) ? (
              <ConnectLinkedInButton />
            ) : null}
          </div>

          {postableRenders.length === 0 ? (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              No finished renders yet. Render the video first, then share it.
            </p>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="share-post-render">
                  Video
                </Label>
                <Select
                  items={renderItems}
                  onValueChange={(value) => {
                    setError(null);
                    setRenderId(String(value));
                  }}
                  value={renderId}
                >
                  <SelectTrigger id="share-post-render">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectGroup key={group.groupLabel}>
                        <SelectGroupLabel>{group.groupLabel}</SelectGroupLabel>
                        {group.renders.map((render: PublishableRenderView) => (
                          <SelectItem key={render.id} value={render.id}>
                            <span className="flex flex-col">
                              <span className="font-medium">
                                {render.sourceName ?? "Full-length video"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {render.dimensionsLabel} · {render.clockLabel}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs" htmlFor="share-post-commentary">
                    Commentary
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {commentary.length}/{MAX_QUICK_COMMENTARY_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="share-post-commentary"
                  maxLength={MAX_QUICK_COMMENTARY_LENGTH}
                  onChange={(event) => setCommentary(event.target.value)}
                  placeholder="What should go with this video?"
                  rows={4}
                  value={commentary}
                />
                <p className="text-xs text-muted-foreground">
                  A starting point. Formatting, links, and per-platform edits
                  are available in the composer.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="h-10 px-4"
                  disabled={!canCompose || pending || renderId === ""}
                  onClick={create}
                  type="button"
                >
                  {pending ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : (
                    <MessageSquareShare aria-hidden />
                  )}
                  <span>
                    {pending ? "Creating draft…" : "Create post in composer"}
                  </span>
                </Button>
              </div>
            </div>
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
