"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { saveSocialPostAction } from "@/app/(authenticated)/app/social/posts/actions";
import { MediaPickerDialog } from "@/components/social/MediaPickerDialog";
import { PlatformPreviewCard } from "@/components/social/PlatformPreviewCard";
import { PostBodyEditor } from "@/components/social/PostBodyEditor";
import { PostMediaAttachments } from "@/components/social/PostMediaAttachments";
import { PostStatusBadge } from "@/components/social/PostStatusBadge";
import { ScheduledPostBanner } from "@/components/social/ScheduledPostBanner";
import { PublishPostPanel } from "@/components/social/PublishPostPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import type { PortableDocument } from "@/lib/social/portable-document";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";
import {
  selectEligiblePlatforms,
  summarizeAttachments,
} from "@/lib/social/select-eligible-platforms";
import type {
  PostAttachmentView,
  SocialPostComposerView,
} from "@/lib/social/social-post-view";
import { MAX_POST_NAME_LENGTH } from "@/lib/schemas/social-post";

/**
 * The post composer.
 *
 * The plain text and per-platform eligibility are derived from the live document
 * on every keystroke using the **same pure functions the server uses**, so what
 * the previews show is exactly what the publish path will send and accept.
 */
export function PostComposer({
  canPublish,
  library,
  view,
}: {
  canPublish: boolean;
  library: MediaAssetView[];
  view: SocialPostComposerView;
}) {
  const [name, setName] = useState(view.name);
  const [document, setDocument] = useState<PortableDocument>(view.bodyDocument);
  const [attachments, setAttachments] = useState<PostAttachmentView[]>(
    view.attachments,
  );
  const [version, setVersion] = useState(view.version);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const plainText = useMemo(
    () => renderPortableDocumentToPlainText(document),
    [document],
  );

  const eligibility = useMemo(
    () =>
      selectEligiblePlatforms({
        attachments: summarizeAttachments(
          attachments.map((attachment) => attachment.asset.kind),
        ),
        plainTextLength: plainText.length,
      }),
    [attachments, plainText.length],
  );

  const eligibleCount = eligibility.filter((entry) => entry.eligible).length;

  function save() {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("postId", view.id);
      data.set("expectedVersion", String(version));
      data.set("name", name);
      data.set("bodyDocument", JSON.stringify(document));
      for (const attachment of attachments)
        data.append("mediaAssetIds", attachment.asset.id);

      const result = await saveSocialPostAction(data);
      if (result.ok) {
        setVersion(result.version);
        setSavedAt(new Date().toLocaleTimeString());
      } else setError(result.error);
    });
  }

  function moveAttachment(assetId: string, direction: -1 | 1) {
    setAttachments((current) => {
      const index = current.findIndex(
        (attachment) => attachment.asset.id === assetId,
      );
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            className="px-0"
            nativeButton={false}
            render={<Link href="/app/social/posts" />}
            size="sm"
            variant="link"
          >
            ← All posts
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {name.trim() === "" ? "Untitled post" : name}
            </h1>
            <PostStatusBadge status={view.status} />
          </div>
        </div>
        {view.editable ? (
          <div className="flex items-center gap-3">
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {savedAt ? `Saved at ${savedAt}` : null}
            </p>
            <Button disabled={pending} onClick={save} type="button">
              {pending ? (
                <>
                  <Loader2Icon aria-hidden className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save draft"
              )}
            </Button>
          </div>
        ) : null}
      </header>

      {view.status === "scheduled" && view.scheduledAt ? (
        <ScheduledPostBanner
          canPublish={canPublish}
          postId={view.id}
          scheduledAt={view.scheduledAt}
          timezone={view.scheduledTimezone}
        />
      ) : null}

      {!view.editable ? (
        <p className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
          This post is {view.status.replace("_", " ")} and can no longer be
          edited. Its destinations and their outcomes are below.
        </p>
      ) : null}

      {error ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-name">Internal name</Label>
            <Input
              disabled={!view.editable || pending}
              id="post-name"
              maxLength={MAX_POST_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
              placeholder="Launch announcement"
              value={name}
            />
            <p className="text-xs text-muted-foreground">
              Only for finding this post again. Never sent to a platform.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Post</p>
            <PostBodyEditor
              editable={view.editable && !pending}
              initialDocument={view.bodyDocument}
              onChange={setDocument}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Media</p>
              {view.editable ? (
                <MediaPickerDialog
                  attachedIds={attachments.map(
                    (attachment) => attachment.asset.id,
                  )}
                  library={library}
                  onConfirm={(assets) =>
                    setAttachments((current) => [
                      ...current,
                      ...assets.map((asset) => ({
                        asset,
                        removedFromLibrary: false,
                      })),
                    ])
                  }
                />
              ) : null}
            </div>
            <PostMediaAttachments
              attachments={attachments}
              editable={view.editable && !pending}
              onMove={moveAttachment}
              onRemove={(assetId) =>
                setAttachments((current) =>
                  current.filter(
                    (attachment) => attachment.asset.id !== assetId,
                  ),
                )
              }
            />
          </div>
        </div>

        <aside className="space-y-3">
          <PublishPostPanel
            canPublish={canPublish}
            connections={view.availableConnections}
            eligibility={eligibility}
            hasUnsavedChanges={plainText !== view.bodyPlainText}
            postId={view.id}
            scheduledAt={view.scheduledAt}
            targets={view.targets}
          />

          <div>
            <h2 className="text-sm font-medium">What each platform receives</h2>
            <p className="text-xs text-muted-foreground">
              {eligibleCount} of {eligibility.length} destinations can take this
              post right now.
            </p>
          </div>
          {eligibility.map((entry) => (
            <PlatformPreviewCard
              eligibility={entry}
              key={entry.platform}
              plainText={plainText}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
